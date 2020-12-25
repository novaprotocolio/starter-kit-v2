package main

import (
	"context"
	"fmt"
	"github.com/hydroprotocol/amm-bots/algorithm"
	"github.com/hydroprotocol/amm-bots/client"
	"github.com/shopspring/decimal"
	"os"
	"os/signal"
)

func main() {

	botType := os.Getenv("BOT_TYPE")

	switch botType {
	case "CONST_PRODUCT":
		startConstProductBot()
	}

}

/*
Env checklist:
 - BOT_PRIVATE_KEY
 - BOT_QUOTE_TOKEN
 - BOT_BASE_URL
 - BOT_MIN_PRICE
 - BOT_MAX_PRICE
 - BOT_PRICE_GAP
 - BOT_EXPAND_INVENTORY
 - BOT_WEB3_URL
*/
func startConstProductBot() {


	makerClientOne := client.NewHydroClient(
		os.Getenv("BOT_PRIVATE_KEY_ONE"),
		os.Getenv("BOT_BASE_TOKEN_ONE"),
		os.Getenv("BOT_QUOTE_TOKEN_ONE"),
		os.Getenv("BOT_BASE_URL_ONE"),
	)

	makerClientTwo := client.NewHydroClient(
		os.Getenv("BOT_PRIVATE_KEY_TWO"),
		os.Getenv("BOT_BASE_TOKEN_TWO"),
		os.Getenv("BOT_QUOTE_TOKEN_TWO"),
		os.Getenv("BOT_BASE_URL_TWO"),
	)

	minPrice, _ := decimal.NewFromString(os.Getenv("BOT_MIN_PRICE"))
	maxPrice, _ := decimal.NewFromString(os.Getenv("BOT_MAX_PRICE"))
	priceGap, _ := decimal.NewFromString(os.Getenv("BOT_PRICE_GAP"))
	expandInventory, _ := decimal.NewFromString(os.Getenv("BOT_EXPAND_INVENTORY"))
	web3Url := os.Getenv("BOT_WEB3_URL")

	bot := algorithm.NewConstProductBot(
		makerClientOne,
		makerClientTwo,
		minPrice,
		maxPrice,
		priceGap,
		expandInventory,
		web3Url,
	)

	ctx, cancel := context.WithCancel(context.Background())
	bot.Run(ctx)

	block := make(chan bool)
	signalChan := make(chan os.Signal)

	signal.Notify(signalChan, os.Interrupt)

	go func() {
		<- signalChan
		cancel()
		block <- true
	}()

	<- block
	fmt.Println("Stop bot")
}
