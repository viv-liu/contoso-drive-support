import './drivers.css';
import { RESX } from '../../strings'
import { Config } from '../../config';
import { Styles } from '../../shared/styles';
import { AuthContext } from '../../context/authContext';
import usePromise from '../../hooks/usePromise';
import BeatLoader from 'react-spinners/BeatLoader';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as Icons from '@fortawesome/free-solid-svg-icons'

import axios from 'axios';
import React from 'react';

/* API */

function getAppRoles(authContext: any, appHost: any) {
    return new Promise(async (resolve, reject) => {
        const accessToken = await authContext.getCentralAccessToken();
        axios.get(`https://${appHost}/api/preview/roles`, { headers: { Authorization: 'Bearer ' + accessToken } })
            .then((res) => {
                resolve(res.data.value);
            })
            .catch((error) => {
                reject(error);
            });
    });
}

function inviteUser(authContext: any, appHost: any, invitedUserEmailAddress: string, deviceId: string, templateId: string, roleId: string) {
    return new Promise(async (resolve, reject) => {
        const accessToken = await authContext.getGraphAccessToken();
        axios.post(`https://graph.microsoft.com/v1.0/invitations`, { 'invitedUserEmailAddress': invitedUserEmailAddress, 'inviteRedirectUrl': Config.inviteRedirectURL }, { headers: { Authorization: 'Bearer ' + accessToken } })
            .then(async (res) => {
                if (res.data.status !== 'PendingAcceptance') { reject('Rejecting for: ' + res.data.status); return; }

                const centralAccessToken = await authContext.getCentralAccessToken();
                const id = res.data.invitedUser.id;
                const inviteUrl = res.data.inviteRedeemUrl;
                let userRes: any = {};

                axios.put(`https://${appHost}/api/preview/users/${id}`,
                    {
                        'type': 'EmailUser',
                        'roles': [{ 'role': roleId }],
                        'email': invitedUserEmailAddress
                    }, { headers: { Authorization: 'Bearer ' + centralAccessToken } })
                    .then((res) => {
                        userRes = res;
                        if (!deviceId || deviceId === '') { return; }
                        return axios.put(`https://${appHost}/api/preview/devices/${deviceId}`,
                            {
                                'instanceOf': templateId,
                                'displayName': deviceId
                            }, { headers: { Authorization: 'Bearer ' + centralAccessToken } })
                    })
                    .then(() => {
                        if (!deviceId || deviceId === '') { return; }
                        return axios.put(`https://${appHost}/api/preview/devices/${deviceId}/cloudProperties`,
                            {
                                'operator': invitedUserEmailAddress
                            }, { headers: { Authorization: 'Bearer ' + centralAccessToken } })
                    })
                    .then(() => {
                        resolve(Object.assign({}, userRes.data, { inviteRedeemUrl: inviteUrl, deviceIdCreated: deviceId }))
                    })
                    .catch((error) => {
                        reject(error);
                    });
            })
            .catch((error) => {
                reject(error);
            });
    });
}

export default function Drivers() {

    const authContext: any = React.useContext(AuthContext);
    const [selectedApp, setSelectedApp] = React.useState<any>({});
    const [selectedRoleId, setSelectedRoleId] = React.useState<any>('');
    const [payload, setPayload] = React.useState<any>({});

    const appHost = selectedApp.properties ? selectedApp.properties.subdomain + Config.AppDNS : null;
    const templateId = selectedApp.properties ? authContext.filteredAppsTemplates[selectedApp.properties.applicationId] || null : null;

    const [loadingRoles, appRoles, , fetchRoles] = usePromise({ promiseFn: () => getAppRoles(authContext, appHost) });
    const [invitingUser, inviteResponse, errorInviting, callInviteUser] = usePromise({ promiseFn: () => inviteUser(authContext, appHost, payload.invitedUserEmailAddress, payload.deviceId, templateId, selectedRoleId) });

    // eslint-disable-next-line
    React.useEffect(() => { if (appHost) { fetchRoles(); } }, [selectedApp])

    const appsDom: any = [];
    for (const a in authContext.activeSubscription.apps) {
        const app = authContext.activeSubscription.apps[a]
        const include = authContext.filteredApps.indexOf(app.properties.applicationId) > -1;
        if (!include) { continue; }
        appsDom.push(<div key={app.properties.applicationId} className='template-selector-card'>
            <button className='btn btn-selector' onClick={() => { setSelectedApp(app) }}>
                <div><FontAwesomeIcon icon={Icons.faCheck} size='3x' color={selectedApp.properties && selectedApp.properties.applicationId === app.properties.applicationId ? Styles.successColorAlt : Styles.brightColorDim} /></div>
                <div>{app.properties.displayName}</div>
            </button>
        </div >)
    }

    const rolesDom: any = [];
    for (const r in appRoles) {
        const role = appRoles[r];
        rolesDom.push(<div key={role.id} className='template-selector-card'>
            <button className='btn btn-selector' onClick={() => { setSelectedRoleId(role.id) }}>
                <div><FontAwesomeIcon icon={Icons.faCheck} size='3x' color={selectedRoleId !== '' && selectedRoleId === role.id ? Styles.successColorAlt : Styles.brightColorDim} /></div>
                <div>{role.displayName}</div>
            </button>
        </div >)
    }

    const updatePayload = (e) => {
        const s: any = Object.assign({}, payload);
        s[e.target.name] = e.target.value;
        setPayload(s);
    }

    return <div className='drivers-page'>
        <h3>{RESX.driver.title}</h3>
        <div className='form-selector drivers-selector'>
            {appsDom}
        </div>

        {Object.keys(selectedApp).length > 0 ?
            <>
                <h3>{RESX.driver.title2}</h3>
                <a href={`https://${appHost}/admin/roles`} rel='noreferrer' target='_blank'>{RESX.driver.cta1Label}</a>
                <br /><br />
                {Object.keys(selectedApp).length !== 0 && loadingRoles ? <div className='loader'><label>{RESX.app.fetching}</label><BeatLoader size='16px' /></div> :
                    <>
                        <div className='form-selector drivers-selector'>{rolesDom}</div>
                        <h3>{RESX.driver.title3}</h3>
                        <div className='form'>
                            <div className='fields'>
                                <label>{RESX.driver.form.field1Label}</label><br />
                                <input autoComplete='off' type='text' name='invitedUserEmailAddress' value={payload.invitedUserEmailAddress} onChange={updatePayload} placeholder={RESX.driver.form.field1Label_placeholder} />
                            </div>
                            <div className='fields'>
                                <label>{RESX.driver.form.field2Label}</label><br />
                                <input autoComplete='off' type='text' name='deviceId' value={payload.deviceId} onChange={updatePayload} placeholder={RESX.driver.form.field2Label_placeholder} />
                            </div>
                        </div>
                        <br />
                        <button onClick={() => { callInviteUser() }} className='btn btn-primary'>{RESX.driver.form.cta1Label}</button>

                        {invitingUser ? <><div className='loader'><label>{RESX.driver.inviteWaiting}</label><BeatLoader size='16px' /></div></> : null}

                        {!invitingUser && inviteResponse ?
                            <div className='form'>
                                <div className='fields'>
                                    <label>{RESX.driver.inviteUrl}</label>
                                    <input autoComplete='off' type='text' readOnly={true} value={inviteResponse.inviteRedeemUrl} />
                                </div>
                                <div className='fields'>
                                    <label>{RESX.driver.inviteApplicationHost}</label>
                                    <input autoComplete='off' type='text' readOnly={true} value={appHost || ''} />
                                </div>
                                <div className='fields'>
                                    <label>{RESX.driver.inviteDeviceId}</label>
                                    <input autoComplete='off' type='text' readOnly={true} value={inviteResponse.deviceIdCreated} placeholder={RESX.driver.inviteNoDevice} />
                                </div>
                            </div>
                            : null}
                        {!invitingUser && errorInviting ? <><br /><br /><label>{RESX.driver.inviteError}</label><span className='error'>{errorInviting.response.data.error.message}</span></> : null}
                    </>}
            </>
            : null
        }
    </div>
}