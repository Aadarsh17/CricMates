import { EventEmitter } from 'events';

// This is a simple event emitter that can be used to broadcast errors
// from anywhere in the app.
export const errorEmitter = new EventEmitter();
