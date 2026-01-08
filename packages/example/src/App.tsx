import { useEffect, useState } from 'react';
import { getClient, pair, setup } from '../../src/api/index';
import './App.css';
import { Lattice } from './Lattice';

function App() {
  const [label, setLabel] = useState('No Device');

  const getStoredClient = () =>
    window.localStorage.getItem('storedClient') || '';

  const setStoredClient = (storedClient: string | null) => {
    if (!storedClient) return;
    window.localStorage.setItem('storedClient', storedClient);

    const client = getClient();
    setLabel(client?.getDeviceId() || 'No Device');
  };

  useEffect(() => {
    if (getStoredClient()) {
      setup({ getStoredClient, setStoredClient });
    }
  }, []);

  const submitInit = (e: any) => {
    e.preventDefault();
    const deviceId = e.currentTarget[0].value;
    const password = e.currentTarget[1].value;
    const name = e.currentTarget[2].value;
    setup({
      deviceId,
      password,
      name,
      getStoredClient,
      setStoredClient,
    });
  };

  const submitPair = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // @ts-expect-error - bad html types
    const pairingCode = e.currentTarget[0].value.toUpperCase();
    pair(pairingCode);
  };

  return (
    <div className="App">
      <h1>EXAMPLE APP</h1>
      <div style={{ display: 'flex' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            margin: '15px',
            padding: '25px',
            border: '1px solid black',
          }}
        >
          <form
            onSubmit={submitInit}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <input type="text" placeholder="Device Id" />
            <input type="password" placeholder="Password" />
            <input
              type="text"
              placeholder="App Name"
              defaultValue="Example App"
            />
            <button type="submit">Submit</button>
          </form>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            margin: '15px',
            padding: '25px',
            border: '1px solid black',
          }}
        >
          <form
            onSubmit={submitPair}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <input type="text" placeholder="pairing code" />
            <button type="submit">Submit</button>
          </form>
        </div>
        <Lattice label={label} />
      </div>
    </div>
  );
}

export default App;
