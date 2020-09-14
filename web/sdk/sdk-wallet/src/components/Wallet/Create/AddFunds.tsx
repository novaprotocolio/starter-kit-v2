import * as React from "react";
import { connect } from "react-redux";
import { setWalletStep, WALLET_STEPS } from "../../../actions/wallet";
import Svg from "../../Svg";
import { WalletState } from "../../../reducers/wallet";

interface Props {
  dispatch: any;
  walletTranslations: { [key: string]: any };
}

const mapStateToProps = (state: { WalletReducer: WalletState }) => {
  const WalletState = state.WalletReducer;
  return {
    walletTranslations: WalletState.get("walletTranslations")
  };
};

class AddFunds extends React.PureComponent<Props, any> {
  public render() {
    const { walletTranslations } = this.props;
    return (
      <div className="NovaSDK-addFunds">
        <div className="NovaSDK-buttonGroup">
          <a href="https://www.coinbase.com" target="_blank" rel="noopener noreferrer">
            <div className="button coinbase">
              <Svg name="Coinbase" />
            </div>
          </a>
          <a href="https://gemini.com/" target="_blank" rel="noopener noreferrer">
            <div className="button gemini">
              <Svg name="Gemini" />
            </div>
          </a>
        </div>
        <div className="NovaSDK-desc">{walletTranslations.addFundsDesc}</div>
        <button
          className="NovaSDK-button NovaSDK-submitButton NovaSDK-featureButton"
          onClick={() => this.props.dispatch(setWalletStep(WALLET_STEPS.SELECT))}>
          {walletTranslations.done}
        </button>
      </div>
    );
  }
}

export default connect(mapStateToProps)(AddFunds);
