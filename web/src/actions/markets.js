import BigNumber from 'bignumber.js';
import api from '../lib/api';
import { saveCurrentMarket } from '../lib/session';

export const updateCurrentMarket = currentMarket => {
  saveCurrentMarket(currentMarket);
  return async dispatch => {
    return dispatch({
      type: 'UPDATE_CURRENT_MARKET',
      payload: { currentMarket }
    });
  };
};

export const loadMarkets = () => {
  return async (dispatch, getState) => {
    const res = await api.get(`/markets`);
    if (res.data.status === 0) {
      const markets = res.data.data.markets;
      markets.forEach(formatMarket);
      return dispatch({
        type: 'LOAD_MARKETS',
        payload: { markets }
      });
    }
  };
};

// load current market trade history
export const loadTradeHistory = marketID => {
  return async (dispatch, getState) => {
    const res = await api.get(`/markets/${marketID}/trades`);
    const currentMarket = getState().market.getIn(['markets', 'currentMarket']);
    if (currentMarket.id === marketID) {
      return dispatch({
        type: 'LOAD_TRADE_HISTORY',
        payload: res.data.data.trades
      });
    }
  };
};

export const formatMarket = market => {
  market.gasFeeAmount = new BigNumber(market.gasFeeAmount);
  market.asMakerFeeRate = new BigNumber(market.asMakerFeeRate);
  market.asTakerFeeRate = new BigNumber(market.asTakerFeeRate);
  market.marketOrderMaxSlippage = new BigNumber(market.marketOrderMaxSlippage);
};
