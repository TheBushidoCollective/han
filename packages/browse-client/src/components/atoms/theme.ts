// Current dashboard colors (from styles.css)
export const theme = {
  colors: {
    background: {
      primary: '#0d1117', // --bg-primary
      secondary: '#161b22', // --bg-secondary
      tertiary: '#21262d', // --bg-tertiary
      hover: '#30363d', // --bg-hover
    },
    text: {
      primary: '#e6edf3', // --text-primary
      secondary: '#8b949e', // --text-secondary
      muted: '#6e7681', // --text-muted
    },
    accent: {
      primary: '#58a6ff', // --accent
      success: '#3fb950', // --success
      warning: '#d29922', // --warning
      danger: '#f85149', // --danger
      purple: '#a371f7', // --purple
    },
    border: {
      default: '#30363d', // --border
      subtle: '#21262d', // --border-subtle
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
  fontSize: {
    xs: '11px',
    sm: '12px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
  },
};

export type Theme = typeof theme;
