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
	End SideClient = "end"
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
		map[string]ConstProductLadder{},
		map[string]ConstProductLadder{},
		minPrice,
		maxPrice,
		priceGap,
		expandInventory,
		web3Url,
		&lock,
		nil,
		decimal.New(0,0),
		End,
		make(chan string),
		nil,
	}
	return &bot
}

type ConstProductBot struct {
	client          *client.HydroClient
	clientTwo		*client.HydroClient
	baseToken       *utils.ERC20
	quoteToken      *utils.ERC20
	ladderMap       map[string]ConstProductLadder
	ladderMapTwo    map[string]ConstProductLadder
	minPrice        decimal.Decimal
	maxPrice        decimal.Decimal
	priceGap        decimal.Decimal
	expandInventory decimal.Decimal
	web3Url         string
	updateLock      *sync.Mutex
	ladders []ConstProductLadder
	centerPrice 	decimal.Decimal
	side 			SideClient
	checkSide		chan string
	cancelTimeoutLoop context.CancelFunc
}

func (b *ConstProductBot) Run(ctx context.Context) {

	// init side
	b.Init()
	b.side = One
	b.CreateSide()

	// client one
	go func() {
		tinker := time.Tick(15 * time.Second)
		for {
			select {
				case <- tinker: {
					for key := range b.ladderMap {
						b.updateLock.Lock()
						b.maintainOrder(key)
						b.updateLock.Unlock()
					}
				}
				case <- ctx.Done(): {
					return
				}
			}
		}
	}()

	// client two
	go func() {
		tinker := time.Tick(15 * time.Second)
		for {
			select {
				case <- tinker: {
					for key := range b.ladderMapTwo {
						b.updateLock.Lock()
						b.maintainOrderTwo(key)
						b.updateLock.Unlock()
					}
				}
				case <- ctx.Done(): {
					return
				}
			}
		}
	}()


	go func() {
		for {
			select {
				case side := <- b.checkSide: {
					b.updateLock.Lock()
					logrus.Info("checkSide ->> ", side)
					if len(b.ladderMap) == 0 || len(b.ladderMapTwo) == 0 {
						b.CreateSide()
					}
					b.updateLock.Unlock()
				}
				case <- ctx.Done(): {
					return
				}
			}
		}
	}()
}

func (b *ConstProductBot) Init() {
	logrus.Info("Run init")
	// stop all
	b.ElegantExit()
	b.ladderMap = map[string]ConstProductLadder{}
	b.ladderMapTwo = map[string]ConstProductLadder{}

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

func (b *ConstProductBot) CreateSide() {

	if b.cancelTimeoutLoop != nil {
		logrus.Info("cancel timout create side")
		b.cancelTimeoutLoop()
	}

	logrus.Info("create side ->> ", b.side)
	if b.side == One {
		b.SideOneToTwo()
		b.side = Two
		goto CHECKTIMEOUT
	}
	if b.side == Two {
		b.SideTwoToOne()
		b.side = End
		goto CHECKTIMEOUT
	}
	if b.side == End {
		b.Init()
		b.side = One
		b.checkSide <- "one"
		goto CHECKTIMEOUT
	}

CHECKTIMEOUT:
	go func() {
		var ctx context.Context
		ctx, b.cancelTimeoutLoop = context.WithCancel(context.Background())
		ctxCancel, _ := context.WithDeadline(context.TODO(), time.Now().Add(time.Duration(50) * time.Second))
		select {
			case <- ctx.Done(): {
				return
			}
			case <- ctxCancel.Done(): {
				logrus.Info("timeout create side")
				b.CreateSide()
			}
		}
	}()
}


func (b *ConstProductBot) SideOneToTwo() {
	var price decimal.Decimal

	for _, ladder := range b.ladders {
		if ladder.UpPrice.LessThanOrEqual(b.centerPrice) {
			price = ladder.UpPrice
			b.createOrder(ladder, utils.BUY, price)
			b.createOrderTwo(ladder, utils.SELL, price)
		} else {
			price = ladder.UpPrice
			b.createOrderTwo(ladder, utils.BUY, price)
			b.createOrder(ladder, utils.SELL, price)
		}
	}
}

func (b *ConstProductBot) SideTwoToOne() {
	var price decimal.Decimal

	for _, ladder := range b.ladders {
		if ladder.UpPrice.LessThanOrEqual(b.centerPrice) {
			price = ladder.UpPrice
			b.createOrderTwo(ladder, utils.BUY, price)
			b.createOrder(ladder, utils.SELL, price)
		} else {
			price = ladder.UpPrice
			b.createOrder(ladder, utils.BUY, price)
			b.createOrderTwo(ladder, utils.SELL, price)
		}
	}
}

func (b *ConstProductBot) createOrder(ladder ConstProductLadder, side string, price decimal.Decimal) {
	//var price decimal.Decimal
	//if side == utils.SELL {
	//	price = ladder.UpPrice
	//} else {
	//	price = ladder.DownPrice
	//}
	orderId, err := b.client.CreateOrder(
		price,
		ladder.Amount,
		side,
		utils.LIMIT,
		0,
	)
	if err != nil {
		logrus.Warn("create order failed ", err)
	} else {
		b.ladderMap[orderId] = ladder
	}
}

func (b *ConstProductBot) createOrderTwo(ladder ConstProductLadder, side string, price decimal.Decimal) {
	//var price decimal.Decimal
	//if side == utils.SELL {
	//	price = ladder.UpPrice
	//} else {
	//	price = ladder.DownPrice
	//}
	orderId, err := b.clientTwo.CreateOrder(
		price,
		ladder.Amount,
		side,
		utils.LIMIT,
		0,
	)
	if err != nil {
		logrus.Warn("create order failed ", err)
	} else {
		b.ladderMapTwo[orderId] = ladder
	}
}

func (b *ConstProductBot) maintainOrder(orderId string) {
	orderInfo, err := b.client.GetOrder(orderId)
	if err != nil {
		logrus.Warn("get order info failed ", err)
	} else {
		if orderInfo.Status == utils.ORDER_CLOSE && orderInfo.FilledAmount.GreaterThan(decimal.Zero) {
			//b.createOrder(b.ladderMap[orderId], utils.ToggleSide(orderInfo.Side))
			delete(b.ladderMap, orderId)
			if len(b.ladderMap) == 0 {
				b.checkSide <- "one"
			}
		}
	}
}

func (b *ConstProductBot) maintainOrderTwo(orderId string) {
	orderInfo, err := b.clientTwo.GetOrder(orderId)
	if err != nil {
		logrus.Warn("get order info failed ", err)
	} else {
		if orderInfo.Status == utils.ORDER_CLOSE && orderInfo.FilledAmount.GreaterThan(decimal.Zero) {
			//b.createOrderTwo(b.ladderMapTwo[orderId], utils.ToggleSide(orderInfo.Side))
			delete(b.ladderMapTwo, orderId)
			if len(b.ladderMapTwo) == 0 {
				b.checkSide <- "one"
			}
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
