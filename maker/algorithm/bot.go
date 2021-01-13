package algorithm

import (
	"context"
	"github.com/hydroprotocol/amm-bots/client"
	"github.com/hydroprotocol/amm-bots/utils"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"sync"
	"time"
)

type SideClient string

const (
	One SideClient = "one"
	Two SideClient = "two"
)

func NewConstProductBot(
	client *client.HydroClient,
	clientTwo *client.HydroClient,
	minPrice decimal.Decimal,
	maxPrice decimal.Decimal,
	priceGap decimal.Decimal,
	expandInventory decimal.Decimal,
	web3Url string) *ConstProductBot {
	baseToken, quoteToken, err := client.GetTradingErc20()
	if err != nil {
		panic(err)
	}
	var lock sync.Mutex
	bot := ConstProductBot{
		client,
		clientTwo,
		baseToken,
		quoteToken,
		make(map[string]chan bool),
		make(map[string]chan bool),
		minPrice,
		maxPrice,
		priceGap,
		expandInventory,
		web3Url,
		&lock,
		nil,
		decimal.New(0,0),
		make(chan bool),
	}
	return &bot
}

type ConstProductBot struct {
	client          *client.HydroClient
	clientTwo		*client.HydroClient
	baseToken       *utils.ERC20
	quoteToken      *utils.ERC20
	orderCheck		map[string]chan bool
	orderCheckTwo		map[string]chan bool
	minPrice        decimal.Decimal
	maxPrice        decimal.Decimal
	priceGap        decimal.Decimal
	expandInventory decimal.Decimal
	web3Url         string
	updateLock      *sync.Mutex
	ladders []ConstProductLadder
	centerPrice 	decimal.Decimal
	blockGroup chan bool
}

func (b *ConstProductBot) Run(ctx context.Context) {

	// init side
	logrus.Info("Run init")
	// stop all
	b.ElegantExit()


	go func() {
		// add 3 thread activate
		b.blockGroup <- true
		b.blockGroup <- true
		b.blockGroup <- true
	}()

	// loop order
	go func() {
		for  {
			select {
				case <- ctx.Done(): {
					return
				}
				default: {
					b.Init()
					b.OrderLoop(ctx)
				}
			}
		}
	}()

	// check order client one
	go func() {
		tinker := time.Tick(3 * time.Second)
		for {
			select {
				case <- tinker: {
					for key := range b.orderCheck {
						go b.maintainOrder(key)
					}
				}
				case <- ctx.Done(): {
					return
				}
			}
		}
	}()

	// check order client two
	go func() {
		tinker := time.Tick(3 * time.Second)
		for {
			select {
			case <- tinker: {
				for key := range b.orderCheckTwo {
					go b.maintainOrderTwo(key)
				}
			}
			case <- ctx.Done(): {
				return
			}
			}
		}
	}()

}

func (b *ConstProductBot) Init() {
	logrus.Info("Init data")

	baseTokenAmount, _, err := b.baseToken.GetBalance(b.web3Url, b.client.Address)
	if err != nil {
		panic(err)
	}
	quoteTokenAmount, _, err := b.quoteToken.GetBalance(b.web3Url, b.client.Address)
	if err != nil {
		panic(err)
	}
	b.ladders, err = GenerateConstProductLadders(
		*baseTokenAmount,
		*quoteTokenAmount,
		b.minPrice,
		b.maxPrice,
		b.priceGap,
		b.expandInventory,
	)
	b.centerPrice = quoteTokenAmount.Div(*baseTokenAmount)

}

func (b *ConstProductBot) OrderLoop(ctx context.Context)  {
	var (
		mutex = &sync.Mutex{}
		wg sync.WaitGroup
	)

	logrus.Info("Loop order")


	for _, ladder := range b.ladders {
		//if ladder.UpPrice.LessThanOrEqual(b.centerPrice) {
		//	//price := ladder.UpPrice
		//	//b.OrderCheck(ctx, block, mutex, &wg, ladder, One , price)
		//	//b.OrderCheck(ctx, block, mutex, &wg, ladder, Two , price)
		//
		//	// not create order
		//	continue
		//} else {
		wg.Add(2)
		price := ladder.UpPrice
		go b.OrderCheck(ctx, mutex, &wg, ladder, One , price)
		go b.OrderCheck(ctx, mutex, &wg, ladder, Two , price)
		//}
	}

	wg.Wait()
	logrus.Info("Loop order after Wait")
}

func (b *ConstProductBot) OrderCheck(ctx context.Context, mutex *sync.Mutex, wg *sync.WaitGroup, ladder ConstProductLadder, side SideClient, price decimal.Decimal)  {

	defer wg.Done()
	defer func() {
		go func() {
			b.blockGroup <- true
		}()
	}()

	logrus.Info("OrderCheck")
	select {
		case <- ctx.Done(): {
			return
		}
		case <- b.blockGroup:
	}
	logrus.Info("Run OrderCheck")

	var (
		orderIdOne string
		orderIdTwo string
		err error
	)


	if side == One {
		orderIdOne, err = b.client.CreateOrder(
			price,
			ladder.Amount,
			utils.BUY,
			utils.LIMIT,
			25,
		)
		if err != nil {
			logrus.Warn("create order failed ", err)
			b.updateLock.Unlock()
			return
		}

		orderIdTwo, err = b.clientTwo.CreateOrder(
			price,
			ladder.Amount,
			utils.SELL,
			utils.LIMIT,
			25,
		)
		if err != nil {
			logrus.Warn("create order failed ", err)
			b.updateLock.Unlock()
			return
		}

	}

	if side == Two {
		orderIdTwo, err = b.clientTwo.CreateOrder(
			price,
			ladder.Amount,
			utils.BUY,
			utils.LIMIT,
			25,
		)
		if err != nil {
			logrus.Warn("create order failed ", err)
			b.updateLock.Unlock()
			return
		}

		orderIdOne, err = b.client.CreateOrder(
			price,
			ladder.Amount,
			utils.SELL,
			utils.LIMIT,
			25,
		)
		if err != nil {
			logrus.Warn("create order failed ", err)
			b.updateLock.Unlock()
			return
		}
	}

	b.updateLock.Lock()
	b.orderCheck[orderIdOne] = make(chan bool)
	b.orderCheckTwo[orderIdTwo] = make(chan bool)
	b.updateLock.Unlock()

	success := 0

	logrus.Info("check timeout order ", orderIdOne, orderIdTwo )
LoopWaiting:
	for {
		select {
			case <- b.orderCheck[orderIdOne]: {
				success++
			}
			case <- b.orderCheckTwo[orderIdTwo]: {
				success++
			}
			case <- time.After(time.Second * time.Duration(25)): {
				logrus.Info("timeout check order ->> ")
				break LoopWaiting
			}
			case <- ctx.Done(): {
				return
			}
		}

		if success == 2 {
			break LoopWaiting
		}
	}

	logrus.Info("exits check timeout order ", orderIdOne, orderIdTwo )

	b.updateLock.Lock()
	delete(b.orderCheck, orderIdOne)
	delete(b.orderCheckTwo, orderIdTwo)
	b.updateLock.Unlock()

	if success < 2 {
		b.client.CancelOrder(orderIdOne)
		b.clientTwo.CancelOrder(orderIdTwo)
	}

	logrus.Info("End OrderCheck")
}

func (b *ConstProductBot) maintainOrder(orderId string) {
	orderInfo, err := b.client.GetOrder(orderId)
	if err != nil {
		logrus.Warn("get order info failed ", err)
	} else {
		if orderInfo.Status == utils.ORDER_CLOSE && orderInfo.FilledAmount.GreaterThan(decimal.Zero) {
			b.orderCheck[orderId] <- true
		}
	}
}

func (b *ConstProductBot) maintainOrderTwo(orderId string) {
	orderInfo, err := b.clientTwo.GetOrder(orderId)
	if err != nil {
		logrus.Warn("get order info failed ", err)
	} else {
		if orderInfo.Status == utils.ORDER_CLOSE && orderInfo.FilledAmount.GreaterThan(decimal.Zero) {
			b.orderCheckTwo[orderId] <- true
		}
	}
}


func (b *ConstProductBot) ElegantExit() {
	b.updateLock.Lock()
	logrus.Info("cancel order client one")
	_, _ = b.client.CancelAllPendingOrders()
	logrus.Info("cancel order client two")
	_, _ = b.clientTwo.CancelAllPendingOrders()
	b.updateLock.Unlock()
}
