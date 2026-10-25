import { design } from '../../js/avatar.js';

// Match the twelve illustrated robots to the closest of the eight existing models.
// Wave/Think/Dance/Flag -> Classic, Flex/Jump -> Hulk, Sprint -> Crusher,
// Balance -> Dome, Hover -> Hover, Lift -> Hammer, Panther -> Spider, Wheelie -> Tank.
const STYLES = [6, 1, 1, 7, 2, 5, 3, 4, 6, 6, 0, 6];
export function robotStyle(player) { return STYLES[design(player)]; }
