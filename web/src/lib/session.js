/**
 * Login Data
 * {
 *   address: "0x....",
 *   hydroAuthentication: "xxx.bbb.ccc"
 * }
 */
import BigNumber from 'bignumber.js';

export const saveLoginData = (address, hydroAuthentication) => {
  window.localStorage.setItem(`loginData-${address}`, JSON.stringify({ address, hydroAuthentication }));
};

export const cleanLoginDate = address => {
  window.localStorage.removeItem(`loginData-${address}`);
};

export const loadAccountHydroAuthentication = address => {
  const savedData = window.localStorage.getItem(`loginData-${address}`);

  if (!savedData) {
    return null;
  }

  let loginData;
  try {
    loginData = JSON.parse(savedData);
  } catch (e) {
    cleanLoginDate(address);
    return null;
  }

  if (loginData.address && loginData.address.toLowerCase() === address.toLowerCase()) {
    return loginData.hydroAuthentication;
  }

  return null;
};

export const saveCurrentMarket = (market) => window.localStorage.setItem('currentMarket', JSON.stringify(market));
export const getCurrentMarket = () => {
  try {
    const savedData = window.localStorage.getItem('currentMarket');
    const market = JSON.parse(savedData);
    market.gasFeeAmount = new BigNumber(market.gasFeeAmount);
    market.asMakerFeeRate = new BigNumber(market.asMakerFeeRate);
    market.asTakerFeeRate = new BigNumber(market.asTakerFeeRate);
    market.marketOrderMaxSlippage = new BigNumber(market.marketOrderMaxSlippage);
    return market;
  } catch (e) {
    return null;
  }
}
