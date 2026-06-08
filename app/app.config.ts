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
      accent: 'accent',
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
    dropdownMenu: {
      slots: {
        content: 'rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/50 min-w-44 p-1 bg-default/70 dark:bg-elevated/65 backdrop-blur-xl backdrop-saturate-150',
        item: 'rounded-lg cursor-pointer before:rounded-lg data-highlighted:before:bg-accent-500/15 data-highlighted:text-accent-600 dark:data-highlighted:text-accent-400',
        itemLeadingIcon: 'group-data-highlighted:text-accent-500',
      },
    },
  },
})
