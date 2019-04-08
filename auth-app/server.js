const express = require('express');
const open = require('open');
const app = express()
const request = require('request-promise');
const config = require('./config.json')

const fs = require('fs')
const cacheFile = './cache.json';
const renewPeriodMs = 3500 * 1000;

const renewToken = async (force = false) => {
  try {
    const creds = require(cacheFile);
    const { token_type, expires_in, expires_at, access_token, refresh_token, user_id } = creds;
    if (force || expires_at < Date.now()) {
      console.log('need to renew since expires_at is before now, or force=true, force is...', force);
      const codeRes = await request.post(config.authority, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: [
          `grant_type=refresh_token`,
          `client_id=${encodeURIComponent(config.clientId)}`,
          `redirect_uri=${encodeURIComponent(config.redirect)}`,
          `client_secret=${encodeURIComponent(config.secret)}`,
          `refresh_token=${encodeURIComponent(refresh_token)}`
        ].join('&')
      });
      {
        const { token_type, expires_in, access_token, scope, refresh_token, user_id } = JSON.parse(codeRes);
        console.log('renew success')
        fs.writeFileSync(cacheFile, JSON.stringify({
          token_type,
          scope,
          expires_in,
          expires_at: Date.now() + (Number(expires_in) * 1000 /* seconds to millis */),
          access_token,
          refresh_token,
          user_id
        }, null, 2));
      }
    }
  } catch (e) {
    console.log(e);
  }
}

if (!fs.existsSync(cacheFile)) {
  open(`${config.gateway}?response_type=code&client_id=${config.clientId}&redirect_uri=${config.redirect}&scope=${config.scopes}`)
} else {
  console.log('scheduled renewals')
  renewToken(true/* force */);
  setInterval(() => {
    renewToken();
  }, renewPeriodMs)
}


app.use(express.static('.'));
app.use(express.json())
app.post('/register', async (req, res) => {
  try {
    if (req.body && req.body.query && req.body.query.code) {
      const codeRes = await request.post(config.authority, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: [
          `grant_type=authorization_code`,
          `client_id=${encodeURIComponent(config.clientId)}`,
          `code=${encodeURIComponent(req.body.query.code)}`,
          `redirect_uri=${encodeURIComponent(config.redirect)}`,
          `client_secret=${encodeURIComponent(config.secret)}`,
        ].join('&')
      });
      const { token_type, scope, expires_in, access_token, refresh_token, user_id } = JSON.parse(codeRes);
      fs.writeFileSync(cacheFile, JSON.stringify({
        token_type,
        scope,
        expires_in,
        expires_at: Date.now() + (Number(expires_in) * 1000 /* seconds to millis */),
        access_token,
        refresh_token,
        user_id
      }, null, 2));
      console.log('saved credentials to', cacheFile, 'scheduling renewal checks')
      setInterval(() => {
        renewToken();
      }, renewPeriodMs)
    }
    res.end();
  } catch (e) {
    console.log(e);
  }
});

app.listen(30662)