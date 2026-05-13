export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      secondary: 'violet',
      neutral: 'slate',
      success: 'emerald',
      info: 'sky',
      warning: 'amber',
      error: 'red',
    },
    button: {
      defaultVariants: {
        color: 'primary',
        variant: 'solid',
        size: 'md',
      },
    },
    card: {
      slots: {
        root: 'rounded-lg',
      },
    },
    textarea: {
      slots: {
        base: 'resize-none min-h-[120px]',
      },
    },
  },
})
