import React from 'react';
import './styles.scss';
import Toggle from "react-toggle";
import { useMediaQuery } from "react-responsive";
import { useSelector, useDispatch } from 'react-redux';
import { CONSTANTS, LANGS } from '../../lib/constants';
import { toggleTheme } from '../../actions/config';
import "react-toggle/style.css"

export const ThemeSwitcher = () => {
    const isDark = useSelector((state) => state.config.get('isDarkTheme'));
    const dispatch = useDispatch();
    useMediaQuery(
        {
            query: "(prefers-color-scheme: dark)"
        },
        undefined,
        prefersDark => {
            dispatch(toggleTheme(prefersDark));
        }
    );

    React.useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add(CONSTANTS.DARK_CLASS)
        } else {
            document.documentElement.classList.remove(CONSTANTS.DARK_CLASS)
        }
    }, [isDark]);

    return (
        <Toggle
            className="toggle-dark-theme"
            checked={isDark}
            onChange={() => {
                dispatch(toggleTheme());
            }}
            icons={{ checked: "🌙", unchecked: "🔆" }}
            aria-label={LANGS.EN['components.theme_switcher.dark_mode']}
        />
    )
};

export default ThemeSwitcher;
