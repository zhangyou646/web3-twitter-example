import WalletConnectProvider from '@walletconnect/web3-provider'
import { providers, utils } from 'ethers'
import Head from 'next/head'
import { useCallback, useEffect, useReducer } from 'react'
import WalletLink from 'walletlink'
import Web3Modal from 'web3modal'
import { ellipseAddress, getChainData } from '../lib/utilities'
import { formatAuthMessage } from '../utils/siwe'
import { auth } from "twitter-api-sdk"
import dotenv from "dotenv"

dotenv.config();

const INFURA_ID = '460f40a260564ac4a4f4b3fffb032dad'

const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider, // required
    options: {
      infuraId: INFURA_ID, // required
    },
  },
  'custom-walletlink': {
    display: {
      logo: 'https://play-lh.googleusercontent.com/PjoJoG27miSglVBXoXrxBSLveV6e3EeBPpNY55aiUUBM9Q1RCETKCOqdOkX2ZydqVf0',
      name: 'Coinbase',
      description: 'Connect to Coinbase Wallet (not Coinbase App)',
    },
    options: {
      appName: 'Coinbase', // Your app name
      networkUrl: `https://mainnet.infura.io/v3/${INFURA_ID}`,
      chainId: 1,
    },
    package: WalletLink,
    connector: async (_, options) => {
      const { appName, networkUrl, chainId } = options
      const walletLink = new WalletLink({
        appName,
      })
      const provider = walletLink.makeWeb3Provider(networkUrl, chainId)
      await provider.enable()
      return provider
    },
  },
}

const CLIENT_ID = process.env.CLIENT_ID as string
const CLIENT_SECRET = process.env.CLIENT_SECRET as string
const authClient = new auth.OAuth2User({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  callback: "https://twitter-auth-nu.vercel.app/callback",
  // callback: "http://127.0.0.1:3000/callback",
  scopes: ["tweet.read", "users.read", "follows.read"],
});

// const client = new Client(authClient);

const t_state = "my-state";

let web3Modal
if (typeof window !== 'undefined') {
  web3Modal = new Web3Modal({
    network: 'mainnet', // optional
    cacheProvider: true,
    providerOptions, // required
  })
}

type StateType = {
  provider?: any
  web3Provider?: any
  address?: string
  chainId?: number
}

type ActionType =
  | {
      type: 'SET_WEB3_PROVIDER'
      provider?: StateType['provider']
      web3Provider?: StateType['web3Provider']
      address?: StateType['address']
      chainId?: StateType['chainId']
    }
  | {
      type: 'SET_ADDRESS'
      address?: StateType['address']
    }
  | {
      type: 'SET_CHAIN_ID'
      chainId?: StateType['chainId']
    }
  | {
      type: 'RESET_WEB3_PROVIDER'
    }

const initialState: StateType = {
  provider: null,
  web3Provider: null,
  address: null,
  chainId: null,
}

function reducer(state: StateType, action: ActionType): StateType {
  switch (action.type) {
    case 'SET_WEB3_PROVIDER':
      return {
        ...state,
        provider: action.provider,
        web3Provider: action.web3Provider,
        address: action.address,
        chainId: action.chainId,
      }
    case 'SET_ADDRESS':
      return {
        ...state,
        address: action.address,
      }
    case 'SET_CHAIN_ID':
      return {
        ...state,
        chainId: action.chainId,
      }
    case 'RESET_WEB3_PROVIDER':
      return initialState
    default:
      throw new Error()
  }
}



export const Home = (): JSX.Element => {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { provider, web3Provider, address, chainId } = state

  const connect = useCallback(async function () {
    // This is the initial `provider` that is returned when
    // using web3Modal to connect. Can be MetaMask or WalletConnect.
    const provider = await web3Modal.connect()

    // We plug the initial `provider` into ethers.js and get back
    // a Web3Provider. This will add on methods from ethers.js and
    // event listeners such as `.on()` will be different.
    const web3Provider = new providers.Web3Provider(provider)

    const signer = web3Provider.getSigner()
    const address = await signer.getAddress()

    const network = await web3Provider.getNetwork()

    dispatch({
      type: 'SET_WEB3_PROVIDER',
      provider,
      web3Provider,
      address,
      chainId: network.chainId,
    })

    // signMessage();
    if (provider) {
      await signMessage(provider,web3Provider,address,network.chainId);
    }

  }, [])

  const signMessage = async (provider, web3Provider, address, chainId) => {
    if (!provider) {
      alert('Provider not connected')
      throw new Error("Provider not connected");
    }
    const msg = formatAuthMessage(address, chainId);
    // const sig = await provider.send("personal_sign", [msg, address]);
    const signer = web3Provider.getSigner();
    const sig = await signer.signMessage(msg);
    console.log("Signature", sig);
    console.log("isValid", utils.verifyMessage(msg, sig) === utils.getAddress(address));
    // localStorage store
    localStorage.setItem('address', address);
    localStorage.setItem('signer', sig);
  }

  const twitterAuth = () =>{
    const authUrl = authClient.generateAuthURL({
      state: t_state,
      code_challenge_method: "s256",
    });
    console.log('CLIENT_ID',CLIENT_ID)
    localStorage.setItem('CLIENT_ID', CLIENT_ID);
    localStorage.setItem('CLIENT_SECRET', CLIENT_SECRET);
    window.open(authUrl);
    // res.redirect(authUrl);
  }

  const disconnect = useCallback(
    async function () {
      await web3Modal.clearCachedProvider()
      if (provider?.disconnect && typeof provider.disconnect === 'function') {
        await provider.disconnect()
      }
      dispatch({
        type: 'RESET_WEB3_PROVIDER',
      })
    },
    [provider]
  )

  // Auto connect to the cached provider
  useEffect(() => {
    if (web3Modal.cachedProvider) {
      connect()
    }
  }, [connect])

  // A `provider` should come with EIP-1193 events. We'll listen for those events
  // here so that when a user switches accounts or networks, we can update the
  // local React state with that new information.
  useEffect(() => {
    if (provider?.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        // eslint-disable-next-line no-console
        console.log('accountsChanged', accounts)
        dispatch({
          type: 'SET_ADDRESS',
          address: accounts[0],
        })
      }

      // https://docs.ethers.io/v5/concepts/best-practices/#best-practices--network-changes
      const handleChainChanged = (_hexChainId: string) => {
        window.location.reload()
      }

      const handleDisconnect = (error: { code: number; message: string }) => {
        // eslint-disable-next-line no-console
        console.log('disconnect', error)
        disconnect()
      }

      provider.on('accountsChanged', handleAccountsChanged)
      provider.on('chainChanged', handleChainChanged)
      provider.on('disconnect', handleDisconnect)

      // Subscription Cleanup
      return () => {
        if (provider.removeListener) {
          provider.removeListener('accountsChanged', handleAccountsChanged)
          provider.removeListener('chainChanged', handleChainChanged)
          provider.removeListener('disconnect', handleDisconnect)
        }
      }
    }
  }, [provider, disconnect])

  const chainData = getChainData(chainId)

  return (
    <div className="container">
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header>
        {address && (
          <div className="grid">
            <div>
              <p className="mb-1">Network:</p>
              <p>{chainData?.name}</p>
            </div>
            <div>
              <p className="mb-1">Address:</p>
              <p>{ellipseAddress(address)}</p>
            </div>
          </div>
        )}
      </header>

      <main>
        <h1 className="title">Web3Modal Example hello</h1>
        {web3Provider ? (
          <button className="button" type="button" onClick={disconnect}>
            Disconnect
          </button>
        ) : (
          <button className="button" type="button" onClick={connect}>
            Connect
          </button>
        )}

      <h1 className="title">Sign Message</h1>
      <button className="button_g" type="button" onClick={() => signMessage(provider, web3Provider, address, chainId)}>
            Sign
      </button>
      

      <h1 className="title">Twitter Authorize</h1>
      <button className="button_g" type="button" onClick={twitterAuth}>
            X Authorize
      </button>
      {/* <CallbackPage state={state} /> */}
      </main>

      <style jsx>{`
        main {
          padding: 5rem 0;
          text-align: center;
        }

        p {
          margin-top: 0;
        }

        .container {
          padding: 2rem;
          margin: 0 auto;
          max-width: 1200px;
        }

        .grid {
          display: grid;
          grid-template-columns: auto auto;
          justify-content: space-between;
        }

        .button {
          padding: 1rem 1.5rem;
          background: ${web3Provider ? 'red' : 'green'};
          border: none;
          border-radius: 0.5rem;
          color: #fff;
          font-size: 1.2rem;
        }

        .button_g {
          padding: 1rem 1.5rem;
          background: green;
          border: none;
          border-radius: 0.5rem;
          color: #fff;
          font-size: 1.2rem;
        }

        .mb-0 {
          margin-bottom: 0;
        }
        .mb-1 {
          margin-bottom: 0.25rem;
        }
      `}</style>

      <style jsx global>{`
        html,
        body {
          padding: 0;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
            Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue,
            sans-serif;
        }

        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  )
}

export default Home
