import { LatticeResponseCode, ProtocolConstants } from '../protocol';

const buildLatticeResponseErrorMessage = ({
  responseCode,
  errorMessage,
}: {
  responseCode?: LatticeResponseCode;
  errorMessage?: string;
}) => {
  const msg: string[] = [];
  if (responseCode) {
    msg.push(`${ProtocolConstants.responseMsg[responseCode]}`);
  }
  if (errorMessage) {
    msg.push('Error Message: ');
    msg.push(errorMessage);
  }
  return msg.join('\n');
};

export class LatticeResponseError extends Error {
  constructor(
    public responseCode?: LatticeResponseCode,
    public errorMessage?: string,
  ) {
    const message = buildLatticeResponseErrorMessage({
      responseCode,
      errorMessage,
    });
    super(message);
    this.name = 'LatticeResponseError';
    this.responseCode = responseCode;
    this.errorMessage = errorMessage;
  }
}
