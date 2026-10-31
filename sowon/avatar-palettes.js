// Clothing dyes only. Face, hair and navigation never depend on the outfit.
export const AVATAR_PALETTES = Object.freeze({
  sage: Object.freeze({ id: 'sage', label: '이끼빛', swatch: '#8eaa98', colors: Object.freeze({ cream: '#e9e4cf', collar: '#f8f0dc', sage: '#8eaa98', sageShade: '#718f81', ribbon: '#b79972', shoe: '#555b56' }) }),
  moon: Object.freeze({ id: 'moon', label: '달빛', swatch: '#91a6c0', colors: Object.freeze({ cream: '#e4e9ef', collar: '#f5f4ed', sage: '#91a6c0', sageShade: '#6f86a2', ribbon: '#d0bd87', shoe: '#505d70' }) }),
  dawn: Object.freeze({ id: 'dawn', label: '새벽빛', swatch: '#cfac91', colors: Object.freeze({ cream: '#f0e0ce', collar: '#fff0db', sage: '#cfac91', sageShade: '#aa836e', ribbon: '#8d9b79', shoe: '#6a5850' }) }),
  plum: Object.freeze({ id: 'plum', label: '매화빛', swatch: '#ad91ac', colors: Object.freeze({ cream: '#e8dae4', collar: '#f9edf0', sage: '#ad91ac', sageShade: '#856e8b', ribbon: '#cbb681', shoe: '#625267' }) }),
});

export function getAvatarPalette(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(AVATAR_PALETTES, id) ? AVATAR_PALETTES[id] : null;
}
