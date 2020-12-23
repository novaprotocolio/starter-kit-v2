import React from 'react';
import './styles.scss';
import { CONSTANTS, LANGS } from '../../lib/constants';

export const ThemeSwitcher = () => {
    const [theme, setTheme] = React.useState(CONSTANTS.THEME.DARK_THEME);
    return (
        <div className="dark-mode">
            <div className="dark-mode-text">{LANGS.EN['components.theme_switcher.dark_mode']}:</div>
            <label className="switch">
                <input className="darkModeSwitch"
                    checked={theme === CONSTANTS.THEME.DARK_THEME}
                    onChange={e => {
                        if (e.target.checked) {
                            setTheme(CONSTANTS.THEME.DARK_THEME);
                        } else {
                            setTheme(CONSTANTS.THEME.LIGHT_THEME);
                        }
                    }}
                    type="checkbox" />
                <span className="slider round"></span>
            </label>
        </div>
    )
};

export default ThemeSwitcher;
