import { useEffect, useState } from 'react';
import { getClient, pair, setup } from '../../index';
import './App.css';
import { Lattice } from './Lattice';

function App() {
  const [storedClient, setStoredClient] = useState(
    window.localStorage.getItem('storedClient') || '',
  );

  useEffect(() => {
    if (storedClient) {
      setup({ storedClient, storeClient: setStoredClient });
    }
  }, []);

  useEffect(() => {
    console.log('storedClient', storedClient);
    window.localStorage.setItem('storedClient', storedClient);
  }, [storedClient]);

  const [reloadBool, setReloadBool] = useState(false);
  const reload = () => {
    console.log('reload', reloadBool);
    setReloadBool((reload) => !reload);
    console.log('statedata', getClient().getStateData());
  };

  const submitInit = (e: any) => {
    e.preventDefault();
    const deviceId = e.currentTarget[0].value;
    const password = e.currentTarget[1].value;
    const name = e.currentTarget[2].value;
    setup({
      deviceId,
      password,
      name,
      storeClient: setStoredClient,
    });
  };

  const submitPair = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const pairingCode = e.currentTarget[0].value;
    console.log('pairingCode', pairingCode);
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
          <button onClick={() => reload()}>reload</button>
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
            onSubmit={submitInit}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <input type="text" placeholder="deviceid" defaultValue="Cd3dtg" />
            <input type="text" placeholder="pw" defaultValue="asdf" />
            <input
              type="text"
              placeholder="app name"
              defaultValue="testName"
              disabled
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
        <Lattice />
        {/* <Lattice /> */}
      </div>
    </div>
  );
}

export default App;
