import { responseMsgs } from '../constants';

const buildLatticeResponseErrorMessage = ({ responseCode, errorMessage }) => {
  const msg: string[] = [];
  if (responseCode) {
    msg.push(`${responseMsgs[responseCode]}`);
  }
  if (errorMessage) {
    msg.push('Error Message: ');
    msg.push(errorMessage);
  }
  return msg.join('\n');
};

export class LatticeResponseError extends Error {
  constructor(
    public responseCode: number,
    public errorMessage: string,
  ) {
    const message = buildLatticeResponseErrorMessage({ responseCode, errorMessage });
    super(message);
    this.name = 'LatticeResponseError';
    this.responseCode = responseCode;
    this.errorMessage = errorMessage;
  }
}
