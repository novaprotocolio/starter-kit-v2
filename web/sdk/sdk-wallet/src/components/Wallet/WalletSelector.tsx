import * as React from "react";
import Select, { Option } from "./Select";
import { truncateAddress } from "../../wallets";
import { AccountState, WalletState } from "../../reducers/wallet";
import { connect } from "react-redux";
import { selectAccount } from "../../actions/wallet";
import { BigNumber } from "ethers/utils";

interface Props {
  walletType: string;
  selectedAccountID: string | null;
  accounts: any;
  dispatch: any;
  walletTranslations: { [key: string]: any };
  unit: string;
  decimals: number;
}

interface State {}

const mapStateToProps = (state: any) => {
  const walletState: WalletState = state.WalletReducer;
  return {
    accounts: walletState.get("accounts"),
    selectedAccountID: walletState.get("selectedAccountID"),
    walletTranslations: walletState.get("walletTranslations"),
    unit: walletState.get("unit"),
    decimals: walletState.get("decimals")
  };
};

class WalletSelector extends React.PureComponent<Props, State> {
  public render() {
    const { selectedAccountID, walletTranslations } = this.props;

    const options = this.getOptions();

    let blankText;
    if (options.length === 0) {
      blankText = walletTranslations.noAvailableAddress;
    } else {
      blankText = walletTranslations.pleaseSelectAddress;
    }
    return (
      <>
        <div className="NovaSDK-fieldGroup">
          <div className="NovaSDK-label">{walletTranslations.selectAddress}</div>
          <Select
            blank={blankText}
            noCaret={options.length === 0}
            disabled={options.length === 0}
            options={options}
            selected={selectedAccountID || ""}
          />
        </div>
      </>
    );
  }

  private getOptions(): Option[] {
    const { walletType, dispatch, unit, decimals } = this.props;

    const options: Option[] = [];

    this.getWalletAccounts(walletType).forEach((account: AccountState, accountID: string) => {
      const text = account.get("address");
      const isLocked = account.get("isLocked");
      const balance = account.get("balance");
      const wallet = account.get("wallet");

      if (text) {
        options.push({
          value: accountID,
          component: (
            <div className="NovaSDK-address-option">
              <span>
                {isLocked ? <i className="NovaSDK-fa fa fa-lock" /> : <i className="NovaSDK-fa fa fa-check" />}
                {truncateAddress(text)}
              </span>
              <span>
                {balance.div(new BigNumber(10).pow(decimals).toString()).toFixed(5)} {unit}
              </span>
            </div>
          ),
          onSelect: (option: Option) => {
            dispatch(selectAccount(option.value, wallet.type()));
          }
        });
      }
    });
    return options;
  }

  private getWalletAccounts(walletType: string): any {
    const { accounts } = this.props;
    return accounts.filter((account: AccountState) => {
      return account.get("wallet").type() === walletType;
    });
  }
}

export default connect(mapStateToProps)(WalletSelector);
