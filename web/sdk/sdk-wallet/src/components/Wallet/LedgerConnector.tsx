import * as React from "react";
import { connect } from "react-redux";
import { Ledger, truncateAddress, getBalance } from "../../wallets";
import { getAccount } from "../..";
import { loadLedger, selectAccount } from "../../actions/wallet";
import Select, { Option } from "./Select";
import { BigNumber } from "bignumber.js";
import ReactPaginate from "react-paginate";
import { WalletState } from "../../reducers/wallet";
import NotSupport from "./NotSupport";

interface Props {
  dispatch: any;
  wallet: Ledger | null;
  isLocked: boolean;
  ledgerConnecting: boolean;
  walletTranslations: { [key: string]: any };
}

interface State {
  loading: boolean;
  addresses: { [key: string]: string };
  balances: { [key: string]: BigNumber };
  pathType: string;
  realPath: string;
  index: number;
  currentAddress: string | null;
  currentPage: number;
  gotoPageInputValue: number;
}

const mapStateToProps = (state: { WalletReducer: WalletState }) => {
  const account = getAccount(state, Ledger.TYPE);
  return {
    wallet: account ? (account.get("wallet") as Ledger) : null,
    isLocked: account ? account.get("isLocked") : true,
    ledgerConnecting: state.WalletReducer.get("ledgerConnecting"),
    walletTranslations: state.WalletReducer.get("walletTranslations")
  };
};

const batchCount = 3;
class LedgerConnector extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      loading: false,
      pathType: Ledger.getPathType(Ledger.currentBasePath),
      realPath: Ledger.currentBasePath,
      index: 0,
      currentPage: 0,
      addresses: {},
      balances: {},
      currentAddress: null,
      gotoPageInputValue: 1
    };
  }

  public componentDidMount() {
    const { wallet } = this.props;
    const { addresses } = this.state;
    if (wallet && wallet.connected) {
      this.loadAddresses();
    }
    if (addresses) {
      this.loadBalances();
    }
  }

  public componentDidUpdate(prevProps: Props, prevState: State) {
    const { wallet } = this.props;
    const { addresses, index, realPath, pathType } = this.state;

    if (
      wallet &&
      wallet.connected &&
      (Object.values(addresses).length === 0 ||
        wallet !== prevProps.wallet ||
        index !== prevState.index ||
        (pathType !== Ledger.CUSTOMIZAION_PATH && realPath !== prevState.realPath))
    ) {
      this.loadAddresses();
    }

    if (addresses !== prevState.addresses) {
      this.loadBalances();
    }
  }

  public render() {
    const { isLocked, ledgerConnecting, walletTranslations } = this.props;

    return (
      <div className="NovaSDK-ledger">
        {this.renderContent()}
        {isLocked && (
          <button
            className="NovaSDK-button NovaSDK-submitButton NovaSDK-featureButton"
            disabled={ledgerConnecting}
            onClick={() => this.connectLedger()}>
            {ledgerConnecting ? <i className="NovaSDK-fa fa fa-spinner fa-spin" /> : null}{" "}
            {walletTranslations.connectLedger}
          </button>
        )}
      </div>
    );
  }

  private renderContent() {
    const { isLocked, walletTranslations } = this.props;
    if (isLocked) {
      return (
        <NotSupport
          iconName="ledger"
          title={walletTranslations.connectLedger}
          desc={walletTranslations.connectLedgerDesc}
        />
      );
    }
    const { loading, currentAddress, pathType } = this.state;
    const addressOptions = this.getAddressOptions();
    const pathOptions = this.getPathOptions();

    return (
      <>
        <div className="NovaSDK-fieldGroup">
          <div className="NovaSDK-label">{walletTranslations.selectPath}</div>
          <Select options={pathOptions} selected={pathType} onSelect={this.selectPath} />
        </div>
        {pathType === Ledger.CUSTOMIZAION_PATH && this.renderCustomizedPath()}
        <div className="NovaSDK-fieldGroup">
          <div className="NovaSDK-label">{walletTranslations.selectAddress}</div>
          <Select
            options={addressOptions}
            selected={!loading && currentAddress}
            noCaret={addressOptions.length === 0}
            disabled={addressOptions.length === 0}
            footer={this.renderFooter()}
            blank={
              loading || addressOptions.length === 0 ? (
                <i className="fa fa-spinner fa-spin" />
              ) : (
                walletTranslations.pleaseSelectAddress
              )
            }
          />
        </div>
      </>
    );
  }

  private renderCustomizedPath() {
    const { realPath, loading } = this.state;
    const { walletTranslations } = this.props;
    return (
      <div className="NovaSDK-fieldGroup">
        <div className="NovaSDK-label">{walletTranslations.inputPath}</div>
        <div className="NovaSDK-customizationInputGroup">
          <span>{Ledger.PREFIX_ETHEREUM_PATH}</span>
          <input
            className="NovaSDK-input"
            placeholder={"0'/0"}
            value={realPath.replace(Ledger.PREFIX_ETHEREUM_PATH, "")}
            onChange={this.handleChangeCustomizedPath}
          />
          <button
            className="NovaSDK-button NovaSDK-featureButton"
            disabled={loading}
            onClick={() => this.loadAddresses()}>
            {loading ? <i className="NovaSDK-fa fa fa-spinner fa-spin" /> : null} Load Accounts
          </button>
        </div>
      </div>
    );
  }

  private handleChangeCustomizedPath = (event: React.ChangeEvent<HTMLInputElement>) => {
    const path = event.target.value;
    const realPath = `${Ledger.PREFIX_ETHEREUM_PATH}${path}`;
    this.setState({ realPath });
  };

  private selectPath = (selectedOption: Option) => {
    const pathType = selectedOption.value;
    if (pathType !== Ledger.CUSTOMIZAION_PATH) {
      this.setState({ realPath: pathType });
    }
    this.setState({ pathType });
  };

  private getPathOptions() {
    return [
      {
        value: Ledger.PATH_TYPE.LEDGER_LIVE,
        component: <div className="NovaSDK-pathItem">Ledger Live</div>
      },
      {
        value: Ledger.PATH_TYPE.LEGACY,
        component: <div className="NovaSDK-pathItem">Legacy (MEW / MyCrypto)</div>
      },
      {
        value: Ledger.CUSTOMIZAION_PATH,
        component: <div className="NovaSDK-pathItem">Customization</div>
      }
    ];
  }

  private getAddressOptions() {
    const { addresses, balances } = this.state;
    const addressOptions: Option[] = [];
    Object.keys(addresses).map((path: string) => {
      const address = addresses[path];
      const balance = balances[address];
      addressOptions.push({
        value: address,
        component: (
          <div className="NovaSDK-address-option">
            <span>
              <i className="NovaSDK-fa fa fa-check" />
              {truncateAddress(address)}
            </span>
            <span>
              {balance ? (
                balance.div("1000000000000000000").toFixed(5)
              ) : (
                <i className="NovaSDK-fa fa fa-spinner fa-spin" />
              )}{" "}
              ETH
            </span>
          </div>
        ),
        onSelect: () => {
          this.selectAccount(address, path);
        }
      });
    });
    return addressOptions;
  }

  private renderFooter() {
    const { currentPage, gotoPageInputValue } = this.state;
    return (
      <>
        <ReactPaginate
          key={currentPage}
          initialPage={currentPage}
          previousLabel={"<"}
          nextLabel={">"}
          breakLabel={"..."}
          pageCount={10000}
          marginPagesDisplayed={0}
          pageRangeDisplayed={2}
          onPageChange={this.changePage}
          containerClassName={"NovaSDK-pagination"}
          breakClassName={"break-me"}
          activeClassName={"active"}
        />
        <div className="NovaSDK-paginationGotoPage">
          Go to page
          <form onSubmit={this.gotoPageSubmit}>
            <input
              className="NovaSDK-input"
              type="number"
              min="1"
              step="1"
              value={gotoPageInputValue}
              onChange={event => this.setState({ gotoPageInputValue: parseInt(event.target.value, 10) })}
            />
          </form>
        </div>
      </>
    );
  }

  private gotoPageSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { gotoPageInputValue } = this.state;
    const pageNumber = Number(gotoPageInputValue) - 1;
    this.setState({
      currentPage: pageNumber,
      index: pageNumber * batchCount
    });
  };

  private changePage = ({ selected }: { [key: string]: any }) => {
    this.setState({
      currentPage: selected,
      index: selected * batchCount
    });
  };

  private async loadAddresses() {
    const { wallet } = this.props;
    if (!wallet) {
      return;
    }
    const { realPath, index } = this.state;
    this.setState({ loading: true });
    const addresses = await wallet.getAddressesWithPath(realPath, index, batchCount);
    this.setState({ addresses, loading: false });
  }

  public selectAccount(address: string, path: string) {
    const parts = path.split("/");
    const pathType = parts.slice(0, parts.length - 1).join("/");
    const index = parseInt(parts[parts.length - 1], 10);
    this.props.dispatch(selectAccount(Ledger.TYPE, Ledger.TYPE));
    Ledger.setPath(pathType, index);
    this.setState({ currentAddress: address });
  }

  private async connectLedger() {
    const { dispatch } = this.props;
    dispatch(selectAccount(Ledger.TYPE, Ledger.TYPE));
    await dispatch(loadLedger());
    const pathType = Ledger.getPathType(Ledger.currentBasePath);
    this.setState({
      pathType,
      realPath: Ledger.currentBasePath
    });
  }
  private loadBalances() {
    const { addresses } = this.state;
    Object.keys(addresses).map(async (path: string) => {
      let { balances } = this.state;
      const address = addresses[path];
      const balance = await getBalance(address);
      balances[address] = new BigNumber(String(balance));
      this.setState({ balances });
      this.forceUpdate();
    });
  }
}

export default connect(mapStateToProps)(LedgerConnector);
