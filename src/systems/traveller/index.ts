import systemData from './system.json';
import type { SystemDefinition } from '../../types/system';

export const travellerSystem: SystemDefinition = systemData as SystemDefinition;

export * from './travellerMath';
