import { Client } from '../client';

export let saveClient: (clientData: string | null) => void;

export const setSaveClient = (fn: (clientData: string | null) => void) => {
  saveClient = fn;
};

export let loadClient: () => Client | undefined;

export const setLoadClient = (fn: () => Client | undefined) => {
  loadClient = fn;
};

let functionQueue: Promise<any>;

export const getFunctionQueue = () => functionQueue;

export const setFunctionQueue = (queue: Promise<any>) => {
  functionQueue = queue;
};
