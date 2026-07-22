/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BasePoint {
  id: string;
  name: string;
  easting: number; // E (m)
  northing: number; // N (m)
  msl: number; // Mean Sea Level (m)
  zone: 47 | 48; // UTM Zone 47N or 48N
  description?: string;
  isDefault?: boolean;
}

export type CommandFormat = 'spaced' | 'comma' | 'json';

export interface AppConfig {
  antennaHeight: number;
  selectedPointId: string;
  commandFormat: CommandFormat;
  decimalPlaces: number;
}
