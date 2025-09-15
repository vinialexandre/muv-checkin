import { extendTheme, ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const colors = {
  black: '#111111',
  white: '#ffffff',
  gray: {
    50: '#f7f7f7',
    100: '#e7e7e7',
    200: '#d4d4d4',
    300: '#bfbfbf',
    400: '#a3a3a3',
    500: '#8c8c8c',
    600: '#6f6f6f',
    700: '#555555',
    800: '#383838',
    900: '#1f1f1f',
  },
  green: { 500: '#1abc9c' },
  red: { 500: '#e74c3c' },
};

const components = {
  Button: {
    baseStyle: { borderRadius: 0, fontWeight: 500 },
    variants: {
      solid: { bg: 'black', color: 'white', _hover: { bg: 'gray.800' }, _active: { bg: 'gray.900' } },
      outline: { borderColor: 'black', color: 'black', _hover: { bg: 'gray.50' } },
      success: { bg: 'green.500', color: 'white' },
      danger: { bg: 'red.500', color: 'white' },
    },
  },
  Heading: { baseStyle: { fontWeight: 400, letterSpacing: '0.02em' } },
  Badge: { baseStyle: { borderRadius: 0 } },
  Input: { baseStyle: { borderRadius: 0 } },
  Select: { baseStyle: { borderRadius: 0 } },
};

const styles = { global: { body: { bg: 'white', color: 'black' } } };

const theme = extendTheme({ config, colors, components, styles });
export default theme;

