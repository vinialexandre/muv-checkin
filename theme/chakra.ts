import { extendTheme, ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const colors = {
  brand: {
    primary: '#ffffff',
    secondary: '#000000',
    accent: '#fff400',
  },
  black: '#000000',
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
  yellow: {
    50: '#fffef5',
    100: '#fffae6',
    200: '#fff5cc',
    300: '#fff0b3',
    400: '#ffe680',
    500: '#fff400',
    600: '#e6dc00',
    700: '#ccc300',
    800: '#b3aa00',
    900: '#998000',
  },
};

const components = {
  Button: {
    baseStyle: { borderRadius: 'md', fontWeight: 600 },
    defaultProps: { variant: 'primary' },
    variants: {
      primary: {
        bg: 'brand.secondary',
        color: 'brand.primary',
        _hover: { bg: 'gray.900', _loading: { bg: 'brand.secondary' } },
        _active: { bg: 'gray.800' },
        _loading: { _hover: { bg: 'brand.secondary' } },
      },
      secondary: {
        bg: 'brand.accent',
        color: 'brand.secondary',
        _hover: { bg: 'yellow.500', _loading: { bg: 'brand.accent' } },
        _active: { bg: 'yellow.600' },
        _loading: { _hover: { bg: 'brand.accent' } },
      },
      outline: {
        border: '1px solid',
        borderColor: 'brand.secondary',
        color: 'brand.secondary',
        _hover: { bg: 'gray.50' },
      },
      ghost: {
        bg: 'transparent',
        color: 'brand.secondary',
        _hover: { bg: 'gray.100' },
      },
      solid: (props: any) => {
        const { colorScheme: c } = props
        if (c === 'yellow') {
          return {
            bg: 'yellow.500',
            color: 'black',
            _hover: { bg: 'yellow.600', _loading: { bg: 'yellow.500' } },
            _active: { bg: 'yellow.700' },
            _loading: { _hover: { bg: 'yellow.500' } },
          }
        }
        return {}
      },
    },
  },
  Heading: { baseStyle: { fontWeight: 600, letterSpacing: '0.01em' } },
  Badge: { baseStyle: { borderRadius: 'md' } },
  Input: {
    baseStyle: { field: { borderRadius: 'md' } },
    variants: {
      outline: {
        field: {
          borderColor: 'gray.300',
          _focusVisible: {
            borderColor: 'brand.accent',
            boxShadow: '0 0 0 1px var(--chakra-colors-brand-accent)',
          },
        },
      },
    },
  },
  Select: {
    baseStyle: { field: { borderRadius: 'md' } },
    variants: {
      outline: {
        field: {
          borderColor: 'gray.300',
          _focusVisible: {
            borderColor: 'brand.accent',
            boxShadow: '0 0 0 1px var(--chakra-colors-brand-accent)',
          },
        },
      },
    },
  },
};

const styles = {
  global: {
    'html, body, #__next': { height: '100%' },
    body: { bg: 'brand.primary', color: 'brand.secondary' },
  },
};

const theme = extendTheme({ config, colors, components, styles });
export default theme;
