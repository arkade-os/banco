# Banco

Non-interactive swap protocol for Ark. Banco enables trustless atomic swaps between BTC and assets (or asset-to-asset) on the Ark network without requiring both parties to be online at the same time.

## How it works

Banco uses a **maker/taker** model where the maker publishes an offer and goes offline, and any taker can fulfill it later without the maker's participation. This is made possible by locking funds into a covenant-based VTXO script that enforces swap conditions at the protocol level.

### Roles

- **Maker** -- Creates a swap offer, locks funds into a covenant VTXO, and can go offline.
- **Taker** -- Discovers the offer, builds a fulfillment transaction that satisfies the covenant, and submits it.

### Swap flow

1. **Maker creates an offer** -- The maker specifies what they want (amount and optionally an asset) and generates a covenant script that encodes the swap conditions.

2. **Maker funds the swap address** -- The maker sends their funds (BTC or assets) to a special VTXO whose spending conditions are governed by the covenant. The offer data is embedded in the funding transaction's extension output so the taker can discover it by txid.

3. **Taker discovers and fulfills** -- The taker decodes the offer (either from hex or by reading the extension packet from the funding transaction), selects coins from their own wallet, and builds a transaction that satisfies the covenant. The fulfillment transaction is routed through the introspector (for covenant validation) and then submitted to the Ark server.

4. **Settlement** -- After fulfillment, the maker receives the wanted amount at their address, and the taker receives the maker's locked funds. Both sides settle atomically within a single Ark transaction.

### Cancellation

If the maker set a `cancelDelay`, they can reclaim their locked funds after the CLTV timelock expires via the cancel path in the VTXO taptree.

## The Swap Script

The covenant is an [Arkade script](https://docs.arkadeos.com/experimental/arkade-compiler) embedded in a taproot leaf of the swap VTXO. It uses introspection opcodes to enforce spending conditions without requiring the maker's signature at fulfillment time.

The **fulfill script** verifies two conditions on the transaction outputs:

1. **Value check** -- Output 0 must pay at least `wantAmount` sats (or the equivalent asset amount) using `INSPECTOUTPUTVALUE` and `GREATERTHANOREQUAL64`.
2. **Destination check** -- Output 0 must pay to the maker's scriptPubKey, verified using `INSPECTOUTPUTSCRIPTPUBKEY`.

For **asset swaps** (when `wantAsset` is specified), the script additionally uses `INSPECTOUTASSETLOOKUP` and `FINDASSETGROUPBYASSETID` to verify that the correct asset is delivered with the required amount.

The full VTXO taptree can include up to three leaves:

| Leaf | Purpose | Condition |
|------|---------|-----------|
| **Fulfill** | Covenant script + introspector + server multisig | Taker satisfies the covenant |
| **Cancel** (optional) | CLTV + maker + server multisig | Maker reclaims after timelock |
| **Exit** (optional) | CSV + maker + server multisig | Unilateral exit after relative timelock |

## Offer encoding

Offers are serialized as a sequence of TLV (Type-Length-Value) records and wrapped in an Ark Extension packet (type `0x03`).

| Type | Field | Description |
|------|-------|-------------|
| `0x01` | `swapPkScript` | ScriptPubKey of the swap contract |
| `0x02` | `wantAmount` | Amount the maker wants (8B BE uint64) |
| `0x03` | `wantAsset` | Asset the maker wants as `txid:vout` (optional) |
| `0x04` | `cancelDelay` | CLTV timestamp for cancellation (optional) |
| `0x05` | `makerPkScript` | Maker's taproot scriptPubKey (34B) |
| `0x07` | `makerPublicKey` | Maker's x-only public key (32B) |
| `0x08` | `introspectorPubkey` | Introspector's x-only public key (32B) |
| `0x0b` | `offerAsset` | Asset being offered (optional) |
| `0x0c` | `exitTimelock` | Relative timelock for unilateral exit (optional) |

## Usage

### Installation

```sh
pnpm add @arkade-os/banco
```

### Creating an offer (Maker)

```ts
import { Maker } from "@arkade-os/banco";

const maker = new Maker(wallet, arkServerUrl, introspectorUrl);

const { offer, swapPkScript, packet } = await maker.createOffer({
  wantAmount: 10_000n, // 10k sats
  cancelDelay: 86400,  // cancellable after 24h
});

// Fund the swap address with the asset to sell
await wallet.send({
  address: swapAddress, // derived from swapPkScript
  amount: 0,
  assets: [{ assetId, amount: 1000 }],
});

// Share `offer` (hex string) with potential takers
```

### Fulfilling an offer (Taker)

```ts
import { Taker } from "@arkade-os/banco";

const taker = new Taker(wallet, arkServerUrl, introspectorUrl);

// From hex-encoded offer
const { txid } = await taker.fulfill(offerHex);

// Or from funding transaction ID
const { txid } = await taker.fulfillByTxid(fundingTxid);
```

### Cancelling an offer (Maker)

```ts
const arkTxid = await maker.cancelOffer(offerHex);
```

### Querying offer status

```ts
const offers = await maker.getOffers(swapPkScript);
// [{ txid, vout, value, assets, spendable }]
```

## Supported swap types

| Maker offers | Maker wants | Description |
|-------------|-------------|-------------|
| Asset | BTC | Sell asset for sats |
| BTC | Asset | Buy asset with sats |
| Asset A | Asset B | Asset-to-asset swap |

## Development

```sh
pnpm install
pnpm lint       # check formatting
pnpm test       # run tests
pnpm build      # compile TypeScript
```

## License

[MIT](LICENSE)
