import * as React from "react";
import { connect } from "react-redux";
import WalletSelector from "./WalletSelector";
import Create from "./Create";
import Confirm from "./Create/Confirm";
import Backup from "./Create/Backup";
import AddFunds from "./Create/AddFunds";
import Input from "./Input";
import Select, { Option } from "./Select";
import * as qrImage from "qr-image";
import {
  ExtensionWallet,
  WalletConnectWallet,
  defaultWalletTypes,
  setGlobalNodeUrl,
  Ledger,
  NovaWallet
} from "../../wallets";
import { WalletState, AccountState } from "../../reducers/wallet";
import { getSelectedAccount } from "../../selector/wallet";
import {
  hideWalletModal,
  unlockBrowserWalletAccount,
  WALLET_STEPS,
  setWalletStep,
  deleteBrowserWalletAccount,
  setTranslations,
  loadWallet,
  selectWalletType,
  initCustomLocalWallet,
  setUnit
} from "../../actions/wallet";
import Svg from "../Svg";
import LedgerConnector from "./LedgerConnector";
import { Map } from "immutable";
import NotSupport from "./NotSupport";
import defaultTranslations from "../../i18n";

interface State {
  password: string;
  processing: boolean;
  checkbox: boolean;
}

interface Props {
  dispatch: any;
  nodeUrl?: string;
  defaultWalletType?: string;
  translations?: { [key: string]: any };
  walletTranslations: { [key: string]: any };
  selectedAccount: AccountState | null;
  accounts: Map<string, AccountState>;
  extensionWalletSupported: boolean;
  isShowWalletModal: boolean;
  step: string;
  walletTypes?: string[];
  loadWalletActions?: { [key: string]: any };
  menuOptions?: Option[];
  selectedWalletType: string;
  customLocalWallet?: any;
  LocalWallet: any;
  hideLocalWallet?: boolean;
  unit?: string;
  decimals?: number;
}

class Wallet extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    const { defaultWalletType, translations, dispatch, customLocalWallet, unit, decimals } = this.props;
    dispatch(setTranslations(translations || defaultTranslations));
    if (customLocalWallet) {
      dispatch(initCustomLocalWallet(customLocalWallet));
    }
    if (unit && typeof decimals === "number") {
      dispatch(setUnit(unit, decimals));
    }

    let selectedWalletType: string;
    const lastSelectedWalletType = window.localStorage.getItem("NovaWallet:lastSelectedWalletType");

    if (defaultWalletType) {
      selectedWalletType = defaultWalletType;
    } else if (lastSelectedWalletType) {
      selectedWalletType = lastSelectedWalletType;
    } else {
      selectedWalletType = defaultWalletTypes[0];
    }
    dispatch(selectWalletType(selectedWalletType));

    this.state = {
      password: "",
      processing: false,
      checkbox: false
    };
  }

  public componentDidMount() {
    const { nodeUrl, LocalWallet } = this.props;
    if (nodeUrl) {
      setGlobalNodeUrl(nodeUrl);
      LocalWallet.setNodeUrl(nodeUrl);
    }

    if (document.readyState === "complete") {
      this.loadExtensitonWallet();
    } else {
      window.addEventListener("load", this.loadExtensitonWallet.bind(this));
    }
  }

  public componentDidUpdate(prevProps: Props) {
    const { selectedAccount, isShowWalletModal, dispatch, translations } = this.props;
    if (!isShowWalletModal && isShowWalletModal !== prevProps.isShowWalletModal && selectedAccount) {
      const wallet = selectedAccount.get("wallet");
      dispatch(selectWalletType(wallet.type()));
    }

    if (translations && translations !== prevProps.translations) {
      dispatch(setTranslations(translations));
    }
  }

  private loadExtensitonWallet() {
    const { dispatch, walletTypes, loadWalletActions } = this.props;
    const types = walletTypes ? walletTypes : defaultWalletTypes;
    types.map(type => {
      const loadWalletAction = loadWalletActions ? loadWalletActions[type] : null;
      dispatch(loadWallet(type, loadWalletAction));
    });
  }

  public render() {
    const { isShowWalletModal, dispatch, walletTranslations, selectedWalletType } = this.props;

    return (
      <div className="NovaSDK-wallet">
        <div className="NovaSDK-container" hidden={!isShowWalletModal}>
          <div className="NovaSDK-backdrop" onClick={() => dispatch(hideWalletModal())} />
          <div className="NovaSDK-dialog">
            <div className="NovaSDK-title">{walletTranslations.dialogTitle}</div>
            {walletTranslations.dialogSubtitle && (
              <div className="NovaSDK-desc">{walletTranslations.dialogSubtitle}</div>
            )}
            <div className="NovaSDK-fieldGroup">
              <div className="NovaSDK-label">{walletTranslations.selectWallet}</div>
              <Select options={this.getWalletsOptions()} selected={selectedWalletType} />
            </div>
            {this.renderStepContent()}
            {this.renderUnlockForm()}
            {this.renderDeleteForm()}
            <button className="NovaSDK-button NovaSDK-closeButton" onClick={() => dispatch(hideWalletModal())}>
              {walletTranslations.close}
            </button>
          </div>
        </div>
      </div>
    );
  }

  private renderStepContent() {
    const { extensionWalletSupported, accounts, step, walletTranslations, selectedWalletType } = this.props;
    switch (step) {
      case WALLET_STEPS.SELECT:
      case WALLET_STEPS.DELETE:
        if (selectedWalletType === WalletConnectWallet.TYPE) {
          const account = accounts.get(WalletConnectWallet.TYPE)!;
          if (account.get("isLocked")) return this.renderQrImage();
        } else if (selectedWalletType === Ledger.TYPE) {
          return <LedgerConnector />;
        } else if (selectedWalletType === ExtensionWallet.TYPE && !extensionWalletSupported) {
          return (
            <NotSupport
              iconName="metamask"
              title={walletTranslations.installMetamask}
              desc={walletTranslations.installMetamaskDesc}
            />
          );
        }
        return <WalletSelector walletType={selectedWalletType} />;
      case WALLET_STEPS.CREATE:
        return <Create />;
      case WALLET_STEPS.CREATE_CONFIRM:
        return <Confirm />;
      case WALLET_STEPS.BACKUP:
        return <Backup />;
      case WALLET_STEPS.ADD_FUNDS:
        return <AddFunds />;
      case WALLET_STEPS.IMPORT:
        return <Create isRecovery={true} />;
      default:
        return null;
    }
  }

  private renderQrImage() {
    const { accounts } = this.props;
    const wallet = accounts.get(WalletConnectWallet.TYPE)!.get("wallet");
    const connector = (wallet as any).connector;

    return (
      <div className="NovaSDK-qr-image">
        <div
          className="NovaSDK-qr-image-bg"
          dangerouslySetInnerHTML={{
            __html: qrImage.imageSync(connector.uri, { type: "svg" }).toString()
          }}
        />
      </div>
    );
  }

  private renderUnlockForm() {
    const { password, processing } = this.state;
    const { selectedAccount, step, walletTranslations, selectedWalletType, LocalWallet } = this.props;
    if (
      selectedWalletType !== LocalWallet.TYPE ||
      (step !== WALLET_STEPS.SELECT && step !== WALLET_STEPS.DELETE) ||
      !selectedAccount ||
      !selectedAccount.get("isLocked")
    ) {
      return null;
    }

    return (
      <>
        <Input
          label={walletTranslations.password}
          text={password}
          handleChange={(password: string) => this.setState({ password })}
        />
        <button
          className="NovaSDK-button NovaSDK-submitButton NovaSDK-featureButton"
          disabled={processing}
          onClick={() => this.handleUnlock(selectedAccount)}>
          {processing ? <i className="NovaSDK-fa fa fa-spinner fa-spin" /> : null} {walletTranslations.unlock}
        </button>
      </>
    );
  }

  private renderDeleteForm() {
    const { checkbox, processing } = this.state;
    const { selectedAccount, step, walletTranslations, selectedWalletType, LocalWallet } = this.props;
    if (
      !selectedAccount ||
      selectedAccount.get("isLocked") ||
      selectedAccount.get("wallet").type() !== LocalWallet.TYPE ||
      step !== WALLET_STEPS.DELETE ||
      selectedWalletType !== LocalWallet.TYPE
    ) {
      return null;
    }
    return (
      <>
        <div className="NovaSDK-hint">
          <div className="NovaSDK-hintTitle">
            <i className="NovaSDK-fa fa fa-bullhorn" />
            {walletTranslations.headsUp}
          </div>
          <span>{walletTranslations.deleteTip}</span>
          <div
            className={`NovaSDK-checkboxDiv ${checkbox ? "checked" : ""}`}
            onClick={() => this.setState({ checkbox: !checkbox })}>
            <div className="NovaSDK-checkbox">
              <i className="fa fa-check" />
            </div>
            {walletTranslations.deleteConfirm}
          </div>
        </div>
        <button
          className="NovaSDK-button NovaSDK-submitButton NovaSDK-featureButton"
          disabled={processing || !checkbox}
          onClick={() => this.handleDelete(selectedAccount)}>
          {processing ? <i className="NovaSDK-fa fa fa-spinner fa-spin" /> : null} {walletTranslations.delete}
        </button>
      </>
    );
  }

  private async handleDelete(selectedAccount: AccountState): Promise<void> {
    try {
      this.setState({ processing: true });
      await this.props.dispatch(deleteBrowserWalletAccount(selectedAccount));
    } catch (e) {
      alert(e);
    } finally {
      this.setState({ processing: false });
    }
  }

  private async handleUnlock(selectedAccount: AccountState): Promise<void> {
    try {
      const { password } = this.state;
      this.setState({ processing: true });
      await this.props.dispatch(unlockBrowserWalletAccount(selectedAccount, password));
    } catch (e) {
      alert(e);
    } finally {
      this.setState({ processing: false });
    }
  }

  private getWalletsOptions(): Option[] {
    let { dispatch, menuOptions } = this.props;
    if (!menuOptions) {
      menuOptions = [
        {
          value: ExtensionWallet.TYPE,
          component: (
            <div className="NovaSDK-optionItem">
              <Svg name="metamask" />
              {ExtensionWallet.LABEL}
            </div>
          ),
          onSelect: (option: Option) => {
            ExtensionWallet.enableBrowserExtensionWallet();
            dispatch(setWalletStep(WALLET_STEPS.SELECT));
            dispatch(selectWalletType(option.value));
          }
        },
        {
          value: Ledger.TYPE,
          component: (
            <div className="NovaSDK-optionItem">
              <Svg name="ledger" />
              {Ledger.LABEL}
            </div>
          ),
          onSelect: (option: Option) => {
            dispatch(setWalletStep(WALLET_STEPS.SELECT));
            dispatch(selectWalletType(option.value));
          }
        },
        {
          value: WalletConnectWallet.TYPE,
          component: (
            <div className="NovaSDK-optionItem">
              <Svg name="WalletConnect" />
              {WalletConnectWallet.LABEL}
            </div>
          ),
          onSelect: (option: Option) => {
            dispatch(setWalletStep(WALLET_STEPS.SELECT));
            dispatch(selectWalletType(option.value));
          }
        }
      ];
    }
    return menuOptions.concat(this.localWalletOptions());
  }

  private localWalletOptions() {
    const { dispatch, walletTranslations, LocalWallet, hideLocalWallet } = this.props;
    if (hideLocalWallet) {
      return [];
    }
    const novaWalletsCount = LocalWallet.list().length;
    const isEmptyNovaWallet = novaWalletsCount === 0;
    return [
      {
        value: LocalWallet.TYPE,
        component: (
          <div className={`NovaSDK-optionItem${isEmptyNovaWallet ? " disabled" : ""}`}>
            <Svg name="logo" />
            {LocalWallet.LABEL} ({novaWalletsCount})
          </div>
        ),
        onSelect: (option: Option) => {
          dispatch(setWalletStep(isEmptyNovaWallet ? WALLET_STEPS.CREATE : WALLET_STEPS.SELECT));
          dispatch(selectWalletType(option.value));
        }
      },
      {
        value: WALLET_STEPS.CREATE,
        component: (
          <div className="NovaSDK-optionItem NovaSDK-walletFeature">
            <Svg name="create" />
            {walletTranslations.createWallet}
          </div>
        ),
        onSelect: () => {
          dispatch(setWalletStep(WALLET_STEPS.CREATE));
          dispatch(selectWalletType(LocalWallet.TYPE));
        }
      },
      {
        value: WALLET_STEPS.IMPORT,
        component: (
          <div className="NovaSDK-optionItem NovaSDK-walletFeature">
            <Svg name="import" />
            {walletTranslations.importWallet}
          </div>
        ),
        onSelect: () => {
          dispatch(setWalletStep(WALLET_STEPS.IMPORT));
          dispatch(selectWalletType(LocalWallet.TYPE));
        }
      },
      {
        value: WALLET_STEPS.DELETE,
        component: (
          <div className="NovaSDK-optionItem NovaSDK-walletFeature">
            <Svg name="delete" />
            {walletTranslations.deleteWallet}
          </div>
        ),
        onSelect: () => {
          dispatch(setWalletStep(WALLET_STEPS.DELETE));
          dispatch(selectWalletType(LocalWallet.TYPE));
        }
      }
    ];
  }
}

export default connect((state: any) => {
  const walletState: WalletState = state.WalletReducer;

  return {
    walletTranslations: walletState.get("walletTranslations"),
    selectedAccount: getSelectedAccount(state),
    accounts: walletState.get("accounts"),
    extensionWalletSupported: walletState.get("extensionWalletSupported"),
    isShowWalletModal: walletState.get("isShowWalletModal"),
    step: walletState.get("step"),
    selectedWalletType: walletState.get("selectedWalletType"),
    LocalWallet: walletState.get("LocalWallet") || NovaWallet
  };
})(Wallet);
