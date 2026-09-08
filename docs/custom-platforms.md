# Adding another job/client platform

The radar is intentionally registry-driven. LinkedIn, Upwork, Fiverr and Outlier remain first-class connectors, but the core radar does not use a closed platform enum.

## Add a new platform without changing TypeScript

Set `CLIENT_RADAR_CUSTOM_PLATFORMS` to a JSON array. Example:

```json
[
  {
    "id": "freelancer",
    "displayName": "Freelancer",
    "hosts": ["freelancer.com"],
    "startUrl": "https://www.freelancer.com/jobs/"
  },
  {
    "id": "toptal",
    "displayName": "Toptal",
    "hosts": ["toptal.com"],
    "startUrl": "https://www.toptal.com/"
  }
]
```

On the next server start, these platforms appear in `/api/config` and the browser radar scans them using their own persistent local browser profile.

## How the adapter model works

1. A platform definition supplies an ID, display name, allowed hostnames and starting URL.
2. The generic read-only connector discovers candidate links on that site's page.
3. Every result is converted to the common `Opportunity` model.
4. The existing match, risk, ranking, proposal and approval pipeline handles it exactly like other sources.
5. A future platform can receive a dedicated connector when generic extraction is not accurate enough; the radar core does not need to change.

## Security boundaries

- Only HTTP/HTTPS start URLs are accepted.
- Credentials/passwords are not stored by the platform registry.
- Browser profiles remain local and are ignored by git.
- Discovery is read-only.
- The system does not automatically submit applications, send messages, or accept contracts.

The final external action remains an explicit user approval. This keeps the automation fast without allowing an accidental or fabricated commitment to a client.
