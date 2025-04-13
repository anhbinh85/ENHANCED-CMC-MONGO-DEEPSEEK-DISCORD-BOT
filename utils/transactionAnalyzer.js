// // utils/transactionAnalyzer.js
// require('dotenv').config();

// const EXTERNAL_THRESHOLD = parseFloat(process.env.WHALE_EXTERNAL_TRANSFER_THRESHOLD_BTC || "10");

// /**
//  * Placeholder for checking if an output address belongs to the same wallet cluster
//  * as the input addresses. Needs a proper implementation using clustering data if available.
//  * @param {string} outputAddress - The output address to check.
//  * @param {Set<string>} inputAddresses - A set of all unique input addresses.
//  * @returns {boolean} True if likely internal, false otherwise.
//  */
// function isLikelyInternalAddress(outputAddress, inputAddresses /*, optional walletClusterData */) {
//     // Heuristic 1: Direct match
//     if (inputAddresses.has(outputAddress)) {
//         return true;
//     }
//     // Heuristic 2 (Partial): Check address type (P2PKH, P2SH, P2WPKH, P2TR etc.)
//     // This requires decoding the scriptPubKey, which is complex.
//     // Example: if (getAddressType(outputAddress) === getAddressType(Array.from(inputAddresses)[0])) { ... }

//     // Heuristic 2 (Advanced): If you have wallet clustering data, check if outputAddress
//     // belongs to the same cluster ID as any inputAddress.
//     // if (walletClusterData.getCluster(outputAddress) === walletClusterData.getCluster(someInputAddress)) return true;

//     return false; // Default to assuming external if no strong internal signal
// }

// /**
//  * Analyzes detailed transaction data to identify external whale movements.
//  * @param {object} txDetails - The detailed transaction object from QuickNode RPC.
//  * @returns {object} An analysis result: { isWhaleMovement: boolean, externalValueBTC: number, externalOutputs: Array<{address, value}>, changeOutputs: Array<{address, value}>, feeBTC: number }
//  */
// function analyzeTransaction(txDetails) {
//     if (!txDetails || !txDetails.vin || !txDetails.vout) {
//         console.warn("[TxAnalyzer] Invalid txDetails received.");
//         return { isWhaleMovement: false, externalValueBTC: 0, externalOutputs: [], changeOutputs: [], feeBTC: 0 };
//     }

//     // --- 1. Extract Input Addresses and Calculate Total Input Value ---
//     // NOTE: This requires fetching previous transactions referenced by txDetails.vin
//     //       to get the value of the inputs. getrawtransaction verbosity 2+ often includes this.
//     //       This part is COMPLEX and depends heavily on exact RPC response structure.
//     //       For simplicity here, we'll *assume* input value calculation is handled elsewhere
//     //       or focus only on outputs for a basic version. Let's proceed assuming we know total input value.

//     let totalInputValueBTC = 0; // Placeholder - MUST BE CALCULATED ACCURATELY
//     const inputAddresses = new Set();
//     // TODO: Populate inputAddresses and totalInputValueBTC from txDetails.vin (requires prev_tx details)
//     // Example (pseudo-code, depends on RPC response):
//     // txDetails.vin.forEach(input => {
//     //    inputAddresses.add(input.prevout.scriptPubKey.address); // Get address
//     //    totalInputValueBTC += input.prevout.value; // Sum value (already in BTC usually)
//     // });


//     // --- 2. Calculate Total Output Value & Fee ---
//     let totalOutputValueBTC = 0;
//     txDetails.vout.forEach(output => {
//         totalOutputValueBTC += output.value; // Usually in BTC in decoded tx
//     });

//     // Fee calculation might be inaccurate if totalInputValueBTC isn't precise
//     const feeBTC = Math.max(0, totalInputValueBTC - totalOutputValueBTC); // Ensure fee isn't negative

//     // --- 3. Identify Change Outputs & Sum External Value ---
//     const externalOutputs = [];
//     const changeOutputs = [];
//     let externalValueBTC = 0;

//     txDetails.vout.forEach(output => {
//         if (!output.scriptPubKey || !output.scriptPubKey.address) {
//             console.warn(`[TxAnalyzer] Output missing address info:`, output);
//             return; // Skip outputs without clear address
//         }
//         const outputAddress = output.scriptPubKey.address;
//         const outputValueBTC = output.value;

//         // Apply Heuristics (Simplified Example)
//         // TODO: Implement robust isLikelyInternalAddress function
//         if (isLikelyInternalAddress(outputAddress, inputAddresses)) {
//             // Basic Heuristic 1 check (output address matches an input address)
//              console.log(`[TxAnalyzer] Flagging output to ${outputAddress} (${outputValueBTC} BTC) as likely change/internal.`);
//              changeOutputs.push({ address: outputAddress, value: outputValueBTC });
//         }
//         // TODO: Implement Heuristic 2 (check value against expected change, address type etc.)
//         // else if (isLikelyChangeValue(outputValueBTC, totalInputValueBTC, totalOutputValueBTC, feeBTC) && isNewAddressTypeMatch(...)) { ... }
//         else {
//             // Assume external if not flagged as change/internal
//             externalOutputs.push({ address: outputAddress, value: outputValueBTC });
//             externalValueBTC += outputValueBTC;
//         }
//     });

//     // --- 4. Determine if it's a "Whale Movement" ---
//     const isWhaleMovement = externalValueBTC >= EXTERNAL_THRESHOLD;

//     console.log(`[TxAnalyzer] Tx: ${txDetails.txid.substring(0,10)}... InputValue: ${totalInputValueBTC.toFixed(4)}, OutputValue: ${totalOutputValueBTC.toFixed(4)}, Fee: ${feeBTC.toFixed(8)}, ExternalValue: ${externalValueBTC.toFixed(4)}, IsWhale: ${isWhaleMovement}`);

//     return {
//         txid: txDetails.txid,
//         isWhaleMovement,
//         externalValueBTC,
//         externalOutputs, // Array of { address, value }
//         changeOutputs,   // Array of { address, value }
//         feeBTC,
//         // Include original inputs/outputs if needed downstream?
//     };
// }


// module.exports = {
//     analyzeTransaction,
//     // Potentially export isLikelyInternalAddress if needed elsewhere
// };

require('dotenv').config();

const EXTERNAL_THRESHOLD = parseFloat(process.env.WHALE_EXTERNAL_TRANSFER_THRESHOLD_BTC || "1"); // Adjusted default threshold

/**
 * Checks if an output address is likely internal (e.g., change or self-transfer back to an input).
 * Relies mainly on Heuristic 1: output address matching an input address.
 * @param {string} outputAddress - The output address to check.
 * @param {Set<string>} inputAddresses - A set of all unique input addresses derived from the transaction inputs.
 * @returns {boolean} True if likely internal (matches an input), false otherwise.
 */
function isLikelyInternalAddress(outputAddress, inputAddresses /*, optional walletClusterData */) {
    // Heuristic 1: Direct match - Is the output address one of the input addresses?
    // This is the primary check for self-transfer or change.
    if (inputAddresses.has(outputAddress)) {
        return true;
    }

    // --- Optional Heuristic 2 Placeholders (Require more data/logic) ---
    // Heuristic 2 (Address Type Check): Requires decoding scriptPubKey - complex.
    // Heuristic 2 (Clustering Check): Requires external wallet clustering data.
    // Heuristic 2 (Value Check): Requires accurate total input value, fee, and comparison logic.
    // --- End Placeholders ---

    // Default: If Heuristic 1 doesn't flag it, assume external for now.
    return false;
}

/**
 * Analyzes detailed transaction data (assumed from QuickNode getrawtransaction or similar)
 * to identify external whale movements.
 * IMPORTANT: Requires accurate population of inputAddresses and totalInputValueBTC.
 * @param {object} txDetails - The detailed transaction object (e.g., from QuickNode). Expected fields: txid, vin, vout.
 * vin entries need prevout details (address, value) accessible.
 * vout entries need value, scriptPubKey.address.
 * @returns {object} An analysis result: { txid: string, isWhaleMovement: boolean, externalValueBTC: number, externalOutputs: Array<{address, valueBTC}>, changeOutputs: Array<{address, valueBTC}>, feeBTC: number, inputs: Array<{address, valueBTC}> }
 */
function analyzeTransaction(txDetails) {
    // Initialize result structure
    const result = {
        txid: txDetails?.txid || 'N/A',
        isWhaleMovement: false,
        externalValueBTC: 0,
        externalOutputs: [],
        changeOutputs: [],
        feeBTC: 0,
        inputs: [] // Store simplified input info
    };

    if (!txDetails || !txDetails.vin || !txDetails.vout || !result.txid || result.txid === 'N/A') {
        console.warn("[TxAnalyzer] Invalid or incomplete txDetails received.");
        return result; // Return default empty result
    }

    // --- 1. Extract Input Addresses and Calculate Total Input Value ---
    //    ** CRITICAL TODO FOR USER: Implement this based on your QuickNode RPC response **
    //    You MUST accurately get the address and *value* for each input being spent.
    //    This often requires looking at the previous transaction output referenced in `vin`.
    let totalInputValueBTC = 0;
    const inputAddresses = new Set();

    // Example Pseudocode (Adapt to your actual data structure):
    // ===========================================================
    try {
        for (const input of txDetails.vin) {
            // --- User needs to replace this section ---
            // Assuming 'input.prevout' exists and has 'scriptPubKey.address' and 'value' (in BTC)
            if (input.prevout && input.prevout.scriptPubKey && input.prevout.scriptPubKey.address && typeof input.prevout.value === 'number') {
                 const addr = input.prevout.scriptPubKey.address;
                 const valueBTC = input.prevout.value;
                 inputAddresses.add(addr);
                 totalInputValueBTC += valueBTC;
                 result.inputs.push({ address: addr, valueBTC: valueBTC }); // Store simplified input
            } else {
                 // Handle cases where previous output info isn't directly available
                 // Might require separate RPC calls if using a lower verbosity level
                 console.warn(`[TxAnalyzer] Missing prevout details for input in tx ${result.txid}`);
                 // Consider failing analysis if input value cannot be determined
                 throw new Error(`Incomplete input data for tx ${result.txid}`);
            }
            // --- End of replacement section ---
        }
    } catch (error) {
        console.error(`[TxAnalyzer] Error processing inputs for tx ${result.txid}: ${error.message}`);
        return result; // Cannot analyze reliably without input data
    }
    // ===========================================================

    // --- 2. Calculate Total Output Value & Fee ---
    let totalOutputValueBTC = 0;
    txDetails.vout.forEach(output => {
        // Assuming 'output.value' is in BTC from QuickNode decoded response
        totalOutputValueBTC += output.value || 0;
    });
    // Calculate fee - ensure it's not negative due to potential precision issues
    result.feeBTC = Math.max(0, totalInputValueBTC - totalOutputValueBTC);

    // --- 3. Identify Change Outputs & Sum External Value ---
    let externalValueSat = 0; // Use satoshis for summation to avoid floating point issues

    txDetails.vout.forEach(output => {
        // Ensure output structure is valid
        if (!output.scriptPubKey || !output.scriptPubKey.address || typeof output.value !== 'number') {
            // Skip outputs without a clear address or value (e.g., OP_RETURN)
            // console.warn(`[TxAnalyzer] Skipping output with missing address/value in tx ${result.txid}:`, output);
            return;
        }
        const outputAddress = output.scriptPubKey.address;
        const outputValueBTC = output.value;
        const outputValueSat = Math.round(outputValueBTC * 1e8); // Convert to satoshis

        // Apply Heuristic 1 using the populated inputAddresses set
        if (isLikelyInternalAddress(outputAddress, inputAddresses)) {
            // Flagged as likely change/internal because output matches an input address
            // console.log(`[TxAnalyzer] Flagging output to ${outputAddress} (${outputValueBTC} BTC) as likely change/internal.`);
            result.changeOutputs.push({ address: outputAddress, valueBTC: outputValueBTC });
        }
        // TODO: Add Heuristic 2 checks here if desired and feasible
        // else if (isHeuristic2Match(...)) { ... result.changeOutputs.push(...) ... }
        else {
            // Not flagged by heuristics, assume external
            result.externalOutputs.push({ address: outputAddress, valueBTC: outputValueBTC });
            externalValueSat += outputValueSat;
        }
    });

    result.externalValueBTC = externalValueSat / 1e8; // Convert final external sum back to BTC

    // --- 4. Determine if it's a "Whale Movement" ---
    result.isWhaleMovement = result.externalValueBTC >= EXTERNAL_THRESHOLD;

    // Optional log for debugging
    // console.log(`[TxAnalyzer] Tx: ${result.txid.substring(0,10)}... Inputs: ${inputAddresses.size}, InputValue: ${totalInputValueBTC.toFixed(4)}, OutputValue: ${totalOutputValueBTC.toFixed(4)}, Fee: ${result.feeBTC.toFixed(8)}, ExternalValue: ${result.externalValueBTC.toFixed(4)}, IsWhale: ${result.isWhaleMovement}`);

    return result;
}


module.exports = {
    analyzeTransaction,
};
