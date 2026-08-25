export const colors = {
  bg: '#171310',
  bgStage: '#120F0C',
  bgStageDeep: '#0E0B09',
  bgConsole: '#1A1510',
  surface: '#211C16',
  surface2: '#2A241D',
  outline: '#332C24',
  hairline: '#2A241D',
  ink: '#F2ECE1',
  inkSoft: '#CFC6B8',
  inkSerif: '#E8DFD0',
  inkDim: '#A79C8C',
  inkMeta: '#8A8378',
  inkFaint: '#6E655A',
  ember: '#E4572E',
  emberHot: '#FF6A3C',
  emberTint: 'rgba(228,87,46,0.12)',
  emberChipBg: 'rgba(228,87,46,0.10)',
  onEmber: '#23130C',
  jade: '#58A183',
  jadeTint: 'rgba(88,161,131,0.13)',
  wave: '#FF9A6E',
} as const;

export const radius = {
  card: 20,
  row: 16,
  button: 16,
  badge: 12,
  iconButton: 14,
  pill: 999,
} as const;

export const fonts = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  ui: 'Archivo_400Regular',
  uiMedium: 'Archivo_500Medium',
  uiSemiBold: 'Archivo_600SemiBold',
  uiBold: 'Archivo_700Bold',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
} as const;

export const type = {
  display: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: colors.ink,
  },
  displayLarge: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.ink,
  },
  spoken: {
    fontFamily: fonts.displayItalic,
    fontSize: 19,
    lineHeight: 25,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  bodySmall: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkDim,
  },
  label: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: colors.ink,
  },
} as const;
