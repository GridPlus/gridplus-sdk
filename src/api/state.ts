import { Client } from '../client';

export let saveClient: (clientData: string | null) => Promise<void>;

export const setSaveClient = (fn: (clientData: string | null) => Promise<void>) => {
  saveClient = fn;
};

export let loadClient: () => Promise<Client | undefined>;

export const setLoadClient = (fn: () => Promise<Client | undefined>) => {
  loadClient = fn;
};

let functionQueue: Promise<any>;

export const getFunctionQueue = () => functionQueue;

export const setFunctionQueue = (queue: Promise<any>) => {
  functionQueue = queue;
};
