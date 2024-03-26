import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Client, auth } from "twitter-api-sdk";
import axios from 'axios'

const CallbackPage = () => {
    const [address, setAddress] = useState('');
    const [signer, setSigner] = useState('');
    const [xme, setXme] = useState(null);
    const router = useRouter();
    const { code, state } = router.query; 
    // 如果 code 和 state 都存在且满足条件，则执行后续逻辑
    console.log('code',code)
    console.log('state',state)

    
    const STATE = "my-state";

    useEffect(() => {
        const storedAddress = localStorage.getItem('address');
        const storedSigner = localStorage.getItem('signer');
        setAddress(storedAddress);
        setSigner(storedSigner);
        console.log('CLIENT_ID',localStorage.getItem('CLIENT_ID'))
        const authClient = new auth.OAuth2User({
            client_id: localStorage.getItem('CLIENT_ID'),
            client_secret: localStorage.getItem('CLIENT_SECRET'),
            callback: "https://twitter-auth-nu.vercel.app/callback",
            // callback: "http://127.0.0.1:3000/callback",
            scopes: ["tweet.read", "users.read", "follows.read"],
        });
            
        const client = new Client(authClient);
        
        if (code && state && STATE === state) {
            getTwitterInfo(authClient,client);
        }

        

    }, [code,state]); 

    const getTwitterInfo = async (authClient,client) => {
        console.log('CLIENT_ID',process.env.CLIENT_ID as string)
        await authClient.requestAccessToken(code as string);
        console.log('callback -->token', authClient.token)
        const me = await client.users.findMyUser()
        console.log('findUser->', me)
        if(me) {
            setXme(me);
            const postData = {
                evmAccount: address,
                evmSign: signer,
                btcAccount: "",
                twitterId: me.id,
                twitterName: me.name,
                twitterUsername: me.username,
                tgId: "",
                tgName: ""
            };
            await addUserToApi(postData)
        }
        
    }

    

    const apiHost = 'http://localhost:3001';
    
    const addUserToApi = async (postData: any) => {
    try {
        const response = await axios.post(apiHost+'/api/users', postData);
        console.log('Response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
    }

    // const getUserList = async () => {
    //     try {
    //         const response = await axios.get(apiHost+'/api/users');
    //         console.log('Response:', response.data);
    //         return response.data;
    //         } catch (error) {
    //         console.error('Error:', error);
    //         throw error;
    //         }
    //     };

    return (
        <div>
            <h1>Twitter Callback Page</h1>
            <p>Address: {address}</p>
            <p>Signer: {signer}</p>
            <p>code : {code}</p>
            <p>state : {state}</p>
            <p>twitter : {xme}</p>
            {/* Add your Twitter callback logic here */}
        </div>
    );
};

export default CallbackPage;
