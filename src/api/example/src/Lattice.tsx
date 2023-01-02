import { useEffect, useRef, useState } from 'react';
import {
  addAddressTags,
  fetchAddresses,
  fetchAddressTags,
  getClient,
  sign,
  signMessage,
} from '../..';

export const Lattice = () => {
  const instanceInit = getClient();
  const instance = useRef(instanceInit);
  const [label, setLabel] = useState(instance.current?.name);
  const [addresses, setAddresses] = useState([]);
  const [addressTags, setAddressTags] = useState([]);

  useEffect(() => {
    instance.current = getClient();
    if (instance.current?.name !== label) {
      setLabel(instance.current?.name);
    }
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        margin: '10px',
        padding: '25px',
        border: '1px solid black',
      }}
    >
      <h2>{instance.current?.deviceId}</h2>
      <button onClick={() => sign({})}>Sign</button>
      <button onClick={() => signMessage('test message')}>Sign Message</button>
      <button
        onClick={async () => {
          const addresses = await fetchAddresses();
          console.log({ addresses });
          setAddresses(addresses);
        }}
      >
        Fetch Addresses
      </button>

      <div>
        <h3>Addresses</h3>
        <ul>
          {addresses?.map((address) => (
            <li key={address}>{address}</li>
          ))}
        </ul>
      </div>
      <button
        onClick={async () => {
          await addAddressTags({ test: 'test' });
          const addressTags = await fetchAddressTags();
          console.log({ addressTags });
          setAddressTags(addressTags);
        }}
      >
        Add Address Tag
      </button>
      <button
        onClick={async () => {
          const addressTags = await fetchAddressTags();
          console.log({ addressTags });
          setAddressTags(addressTags);
        }}
      >
        Fetch Address Tags
      </button>
      <div>
        <h3>Address Tags</h3>
        <ul>
          {addressTags?.map((tag: any) => (
            <li key={tag.key}>
              {tag.key}: {tag.val}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
