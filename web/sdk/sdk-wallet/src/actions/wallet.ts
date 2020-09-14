import { BigNumber } from "ethers/utils";
import { getAccount } from "../selector/wallet";
import {
  BaseWallet,
  NovaWallet,
  ExtensionWallet,
  NeedUnlockWalletError,
  NotSupportedError,
  WalletConnectWallet,
  Ledger,
  ImToken
} from "../wallets";
import { AccountState } from "../reducers/wallet";
export const WALLET_STEPS = {
  SELECT: "SELECT",
  CREATE: "CREATE",
  CREATE_CONFIRM: "CREATE_CONFIRM",
  BACKUP: "BACKUP",
  TEST_MNEMONIC: "TEST_MNEMONIC",
  ADD_FUNDS: "ADD_FUNDS",
  IMPORT: "IMPORT",
  DELETE: "DELETE"
};

const TIMER_KEYS = {
  ADDRESS: "ADDRESS",
  STATUS: "STATUS",
  BALANCE: "BALANCE",
  NETWORK: "NETWORK"
};

const timers: { [key: string]: { [key: string]: number } } = {};

const setTimer = (accountID: string, timerKey: string, nextTimer: number) => {
  if (!timers[accountID]) {
    timers[accountID] = {};
  }

  timers[accountID][timerKey] = nextTimer;
};

const clearTimer = (accountID: string) => {
  if (timers[accountID]) {
    Object.values(timers[accountID]).forEach(window.clearTimeout);
    timers[accountID] = {};
  }
};

const isTimerExist = (accountID: string) => {
  return !!timers[accountID];
};

export const cacheWallet = (wallet: NovaWallet, password: string) => {
  return {
    type: "NOVA_WALLET_CACHE_WALLET",
    payload: { wallet, password }
  };
};

export const setUnit = (unit: string, decimals: number) => {
  return {
    type: "NOVA_WALLET_SET_UNIT",
    payload: { unit, decimals }
  };
};

export const initCustomLocalWallet = (walletClass: any) => {
  return {
    type: "NOVA_WALLET_INIT_CUSTOM_LOCAL_WALLET",
    payload: { walletClass }
  };
};

export const selectWalletType = (type: string) => {
  return {
    type: "NOVA_WALLET_SELECT_WALLET_TYPE",
    payload: { type }
  };
};

export const setTranslations = (translations: { [key: string]: string }) => {
  return {
    type: "NOVA_WALLET_SET_TRANSLATIONS",
    payload: { translations }
  };
};

export const setWalletStep = (step: string) => {
  return {
    type: "NOVA_WALLET_SET_STEP",
    payload: { step }
  };
};

export const initAccount = (accountID: string, wallet: BaseWallet) => {
  return {
    type: "NOVA_WALLET_INIT_ACCOUNT",
    payload: {
      accountID,
      wallet
    }
  };
};

export const updateWallet = (wallet: BaseWallet) => {
  return {
    type: "NOVA_WALLET_UPDATE_WALLET",
    payload: {
      wallet
    }
  };
};

export const loadAddress = (accountID: string, address: string | null) => {
  return {
    type: "NOVA_WALLET_LOAD_ADDRESS",
    payload: { accountID, address }
  };
};

export const loadBalance = (accountID: string, balance: BigNumber) => {
  return {
    type: "NOVA_WALLET_LOAD_BALANCE",
    payload: { accountID, balance }
  };
};

export const loadNetwork = (accountID: string, networkId: number | undefined) => {
  return {
    type: "NOVA_WALLET_LOAD_NETWORK",
    payload: {
      accountID,
      networkId
    }
  };
};

export const selectAccount = (accountID: string, type: string) => {
  if (type !== Ledger.TYPE && type !== WalletConnectWallet.TYPE) {
    window.localStorage.setItem("NovaWallet:lastSelectedWalletType", type);
    window.localStorage.setItem("NovaWallet:lastSelectedAccountID", accountID);
  }
  return {
    type: "NOVA_WALLET_SELECT_ACCOUNT",
    payload: { accountID }
  };
};

export const supportExtensionWallet = () => {
  return {
    type: "NOVA_WALLET_SUPPORT_EXTENSION_WALLET"
  };
};

export const lockAccount = (accountID: string) => {
  return {
    type: "NOVA_WALLET_LOCK_ACCOUNT",
    payload: { accountID }
  };
};

export const unlockAccount = (accountID: string) => {
  return {
    type: "NOVA_WALLET_UNLOCK_ACCOUNT",
    payload: { accountID }
  };
};

export const unlockBrowserWalletAccount = (account: AccountState, password: string) => {
  return async (dispatch: any) => {
    const novaWallet = account.get("wallet") as NovaWallet;
    if (novaWallet) {
      await novaWallet.unlock(password);
      dispatch(updateWallet(novaWallet));
      dispatch(unlockAccount(novaWallet.id()));
    }
  };
};

export const deleteBrowserWalletAccount = (account: AccountState) => {
  return async (dispatch: any) => {
    const novaWallet = account.get("wallet") as NovaWallet;
    const isLocked = account.get("isLocked");
    if (novaWallet && !isLocked) {
      const accountID = novaWallet.id();
      clearTimer(accountID);
      dispatch({ type: "NOVA_WALLET_DELETE_ACCOUNT", payload: { accountID } });
      await novaWallet.delete();
    }
  };
};

export const showWalletModal = () => {
  return {
    type: "NOVA_WALLET_SHOW_DIALOG"
  };
};

export const hideWalletModal = () => {
  return {
    type: "NOVA_WALLET_HIDE_DIALOG"
  };
};

export const loadWallet = (type: string, action?: any) => {
  return (dispatch: any, getState: any) => {
    const LocalWallet = getState().WalletReducer.get("LocalWallet") || NovaWallet;
    switch (type) {
      case ExtensionWallet.TYPE:
        return dispatch(loadExtensitonWallet());
      case LocalWallet.TYPE:
        return dispatch(loadLocalWallets());
      case WalletConnectWallet.TYPE:
        return dispatch(loadWalletConnectWallet());
      default:
        if (action) {
          return action();
        }
        return;
    }
  };
};

export const loadExtensitonWallet = () => {
  return async (dispatch: any) => {
    let wallet;
    if (typeof window !== "undefined" && window.ethereum && window.ethereum.isImToken) {
      await ImToken.enableImToken();
      wallet = new ImToken();
    } else {
      await ExtensionWallet.enableBrowserExtensionWallet();
      wallet = new ExtensionWallet();
    }
    if (wallet.isSupported()) {
      dispatch(supportExtensionWallet());
      dispatch(watchWallet(wallet));
    } else {
      window.setTimeout(() => dispatch(loadExtensitonWallet()), 1000);
    }
  };
};

export const loadWalletConnectWallet = () => {
  return async (dispatch: any) => {
    const wallet = new WalletConnectWallet({ bridge: "" });

    if (wallet.connector.connected) {
      await wallet.connector.killSession();
    }

    await wallet.connector.createSession();

    dispatch(watchWallet(wallet));
    const accountID = wallet.id();

    wallet.connector.on("connect", async (error, payload) => {
      if (error) {
        throw error;
      }

      const addresses = await wallet.getAddresses();

      dispatch(unlockAccount(accountID));
      dispatch(selectAccount(accountID, wallet.type()));
      dispatch(loadAddress(accountID, addresses[0]));
      dispatch(loadNetwork(accountID, payload.params[0].chainId));
    });

    wallet.connector.on("session_update", (error, payload) => {
      if (error) {
        throw error;
      }

      // get updated accounts and chainId
      const { accounts, chainId } = payload.params[0];

      dispatch(loadAddress(accountID, accounts[0]));
      dispatch(loadNetwork(accountID, chainId));
    });

    wallet.connector.on("disconnect", async (error, payload) => {
      if (error) {
        throw error;
      }

      window.location.reload();
    });
  };
};

export const loadLocalWallets = () => {
  return (dispatch: any, getState: any) => {
    const LocalWallet = getState().WalletReducer.get("LocalWallet") || NovaWallet;
    LocalWallet.list().map((wallet: any) => {
      dispatch(watchWallet(wallet));
    });
  };
};

export const loadLedger = () => {
  return async (dispatch: any) => {
    const wallet = new Ledger();
    await wallet.initTransport();
    dispatch(watchWallet(wallet));
    dispatch(connectLedger());
  };
};

export const connectLedger = () => {
  return {
    type: "NOVA_WALLET_CONNECT_LEDGER"
  };
};

export const disconnectLedger = () => {
  return {
    type: "NOVA_WALLET_DISCONNECT_LEDGER"
  };
};

export const watchWallet = (wallet: BaseWallet) => {
  return async (dispatch: any, getState: any) => {
    const accountID = wallet.id();
    const type = wallet.type();

    if (isTimerExist(accountID)) {
      clearTimer(accountID);
    }

    if (!getAccount(getState(), accountID)) {
      await dispatch(initAccount(accountID, wallet));
    } else {
      await dispatch(updateWallet(wallet));
    }

    const watchAddress = async () => {
      const timerKey = TIMER_KEYS.ADDRESS;

      let address;
      try {
        const addresses: string[] = await wallet.getAddresses();
        address = addresses.length > 0 ? addresses[0] : null;
      } catch (e) {
        if (type === Ledger.TYPE) {
          dispatch(disconnectLedger());
          clearTimer(accountID);
        } else if (e !== NeedUnlockWalletError && e !== NotSupportedError) {
          throw e;
        }
        address = null;
      }

      const walletIsLocked = wallet.isLocked(address);
      const walletStoreLocked = getState().WalletReducer.getIn(["accounts", accountID, "isLocked"]);

      if (walletIsLocked !== walletStoreLocked) {
        dispatch(walletIsLocked ? lockAccount(accountID) : unlockAccount(accountID));
      }

      const currentAddressInStore = getState().WalletReducer.getIn(["accounts", accountID, "address"]);

      if (currentAddressInStore !== address) {
        dispatch(loadAddress(accountID, address));
        const lastSelectedAccountID = window.localStorage.getItem("NovaWallet:lastSelectedAccountID");
        const currentSelectedAccountID = getState().WalletReducer.get("selectedAccountID");
        if (!currentSelectedAccountID && (lastSelectedAccountID === accountID || !lastSelectedAccountID)) {
          dispatch(selectAccount(accountID, type));
        }
      }

      const nextTimer = window.setTimeout(() => watchAddress(), 3000);
      setTimer(accountID, timerKey, nextTimer);
    };

    const watchBalance = async () => {
      const timerKey = TIMER_KEYS.BALANCE;

      const address = getState().WalletReducer.getIn(["accounts", accountID, "address"]);
      if (address) {
        try {
          const balance = await wallet.getBalance(address);
          const balanceInStore = getState().WalletReducer.getIn(["accounts", accountID, "balance"]);

          if (balance.toString() !== balanceInStore.toString()) {
            dispatch(loadBalance(accountID, balance));
          }
        } catch (e) {
          if (e !== NeedUnlockWalletError && e !== NotSupportedError) {
            throw e;
          }
        }
      }
      const nextTimer = window.setTimeout(() => watchBalance(), 3000);
      setTimer(accountID, timerKey, nextTimer);
    };

    const watchNetwork = async () => {
      const timerKey = TIMER_KEYS.NETWORK;

      try {
        const networkId = await wallet.loadNetworkId();
        if (networkId && networkId !== getState().WalletReducer.getIn(["accounts", accountID, "networkId"])) {
          dispatch(loadNetwork(accountID, networkId));
        }
      } catch (e) {
        if (e !== NeedUnlockWalletError && e !== NotSupportedError) {
          throw e;
        }
      }
      const nextTimer = window.setTimeout(() => watchNetwork(), 3000);
      setTimer(accountID, timerKey, nextTimer);
    };

    Promise.all([watchAddress(), watchBalance(), watchNetwork()]);
  };
};
