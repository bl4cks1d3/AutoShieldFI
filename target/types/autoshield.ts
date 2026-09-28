/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/autoshield.json`.
 */
export type Autoshield = {
  "address": "GPnGSA7KH3vqnF1KfzHGzQNvnEBVD3XRfCayEBhQsuRC",
  "metadata": {
    "name": "autoshield",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "AutoShieldFI - protecao veicular descentralizada na Solana"
  },
  "instructions": [
    {
      "name": "depositLiquidity",
      "discriminator": [
        245,
        99,
        59,
        25,
        151,
        71,
        233,
        249
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "stableMint",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "expireClaim",
      "discriminator": [
        176,
        78,
        241,
        29,
        159,
        81,
        26,
        6
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          },
          "relations": [
            "policy",
            "claim"
          ]
        },
        {
          "name": "policy",
          "writable": true,
          "relations": [
            "claim"
          ]
        },
        {
          "name": "claim",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "faucet",
      "discriminator": [
        0,
        98,
        59,
        30,
        144,
        142,
        113,
        12
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "testMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  101,
                  115,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mintAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "userToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "testMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fileClaim",
      "discriminator": [
        187,
        254,
        40,
        13,
        146,
        223,
        230,
        97
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          },
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true
        },
        {
          "name": "claim",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "fileClaimArgs"
            }
          }
        }
      ]
    },
    {
      "name": "initTestMint",
      "discriminator": [
        198,
        133,
        84,
        4,
        251,
        120,
        196,
        183
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "testMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  101,
                  115,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mintAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializePool",
      "discriminator": [
        95,
        180,
        10,
        172,
        84,
        174,
        232,
        40
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "stableMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "poolParams"
            }
          }
        },
        {
          "name": "assessors",
          "type": {
            "vec": "pubkey"
          }
        },
        {
          "name": "approvalThreshold",
          "type": "u8"
        }
      ]
    },
    {
      "name": "inspectPolicy",
      "discriminator": [
        165,
        69,
        69,
        189,
        3,
        151,
        24,
        26
      ],
      "accounts": [
        {
          "name": "assessor",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          },
          "relations": [
            "policy"
          ]
        },
        {
          "name": "stableMint",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "policy",
          "writable": true
        },
        {
          "name": "vehicle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  104,
                  105,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "policy.plate_hash",
                "account": "policy"
              }
            ]
          }
        },
        {
          "name": "owner",
          "relations": [
            "policy"
          ]
        },
        {
          "name": "ownerToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "stableMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "approve",
          "type": "bool"
        }
      ]
    },
    {
      "name": "payClaim",
      "discriminator": [
        73,
        127,
        176,
        110,
        67,
        8,
        221,
        170
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          },
          "relations": [
            "policy",
            "claim"
          ]
        },
        {
          "name": "stableMint",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "policy",
          "writable": true,
          "relations": [
            "claim"
          ]
        },
        {
          "name": "claim",
          "writable": true
        },
        {
          "name": "claimant",
          "relations": [
            "claim"
          ]
        },
        {
          "name": "claimantToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "claimant"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "stableMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "purchasePolicy",
      "discriminator": [
        246,
        226,
        82,
        107,
        131,
        219,
        247,
        45
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "stableMint",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "args.nonce"
              }
            ]
          }
        },
        {
          "name": "vehicle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  104,
                  105,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "args.plate_hash"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "purchasePolicyArgs"
            }
          }
        }
      ]
    },
    {
      "name": "setAssessors",
      "discriminator": [
        120,
        68,
        133,
        43,
        98,
        114,
        242,
        173
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "assessors",
          "type": {
            "vec": "pubkey"
          }
        },
        {
          "name": "approvalThreshold",
          "type": "u8"
        }
      ]
    },
    {
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "settlePolicy",
      "discriminator": [
        180,
        234,
        21,
        174,
        50,
        214,
        91,
        113
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          },
          "relations": [
            "policy"
          ]
        },
        {
          "name": "stableMint",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "policy",
          "writable": true
        },
        {
          "name": "vehicle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  104,
                  105,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "policy.plate_hash",
                "account": "policy"
              }
            ]
          }
        },
        {
          "name": "owner",
          "relations": [
            "policy"
          ]
        },
        {
          "name": "ownerToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "stableMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "transferAuthority",
      "discriminator": [
        48,
        169,
        76,
        72,
        229,
        180,
        55,
        161
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateParams",
      "discriminator": [
        108,
        178,
        190,
        95,
        94,
        203,
        116,
        20
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "poolParams"
            }
          }
        }
      ]
    },
    {
      "name": "voteClaim",
      "discriminator": [
        119,
        71,
        176,
        255,
        239,
        225,
        251,
        107
      ],
      "accounts": [
        {
          "name": "assessor",
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          },
          "relations": [
            "policy",
            "claim"
          ]
        },
        {
          "name": "policy",
          "writable": true,
          "relations": [
            "claim"
          ]
        },
        {
          "name": "claim",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "approve",
          "type": "bool"
        }
      ]
    },
    {
      "name": "withdrawLiquidity",
      "discriminator": [
        149,
        158,
        33,
        185,
        47,
        243,
        253,
        31
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "position"
          ]
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "stableMint",
          "relations": [
            "pool"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "pool"
          ]
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "claim",
      "discriminator": [
        155,
        70,
        22,
        176,
        123,
        215,
        246,
        102
      ]
    },
    {
      "name": "policy",
      "discriminator": [
        222,
        135,
        7,
        163,
        235,
        177,
        33,
        68
      ]
    },
    {
      "name": "pool",
      "discriminator": [
        241,
        154,
        109,
        4,
        17,
        177,
        109,
        188
      ]
    },
    {
      "name": "stakePosition",
      "discriminator": [
        78,
        165,
        30,
        111,
        171,
        125,
        11,
        220
      ]
    },
    {
      "name": "vehicleRecord",
      "discriminator": [
        193,
        90,
        97,
        158,
        129,
        151,
        10,
        189
      ]
    }
  ],
  "events": [
    {
      "name": "claimFiled",
      "discriminator": [
        78,
        228,
        214,
        247,
        197,
        67,
        130,
        19
      ]
    },
    {
      "name": "claimPaid",
      "discriminator": [
        212,
        155,
        88,
        118,
        128,
        99,
        132,
        42
      ]
    },
    {
      "name": "claimVoted",
      "discriminator": [
        67,
        12,
        39,
        230,
        249,
        12,
        66,
        9
      ]
    },
    {
      "name": "liquidityDeposited",
      "discriminator": [
        218,
        155,
        74,
        193,
        59,
        66,
        94,
        122
      ]
    },
    {
      "name": "liquidityWithdrawn",
      "discriminator": [
        240,
        120,
        73,
        139,
        154,
        31,
        218,
        68
      ]
    },
    {
      "name": "policyInspected",
      "discriminator": [
        190,
        1,
        2,
        207,
        153,
        166,
        215,
        6
      ]
    },
    {
      "name": "policyPurchased",
      "discriminator": [
        120,
        100,
        255,
        218,
        16,
        36,
        194,
        192
      ]
    },
    {
      "name": "policySettled",
      "discriminator": [
        67,
        45,
        149,
        235,
        199,
        184,
        83,
        77
      ]
    },
    {
      "name": "poolInitialized",
      "discriminator": [
        100,
        118,
        173,
        87,
        12,
        198,
        254,
        229
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidParameter",
      "msg": "Parametro invalido"
    },
    {
      "code": 6001,
      "name": "paused",
      "msg": "O protocolo esta pausado"
    },
    {
      "code": 6002,
      "name": "unauthorized",
      "msg": "Operacao nao autorizada"
    },
    {
      "code": 6003,
      "name": "mathOverflow",
      "msg": "Overflow aritmetico"
    },
    {
      "code": 6004,
      "name": "invalidDuration",
      "msg": "Duracao da apolice fora do intervalo permitido (30 a 365 dias)"
    },
    {
      "code": 6005,
      "name": "invalidVehicleValue",
      "msg": "Valor do veiculo invalido"
    },
    {
      "code": 6006,
      "name": "stringTooLong",
      "msg": "Texto excede o tamanho maximo"
    },
    {
      "code": 6007,
      "name": "invalidTier",
      "msg": "Plano de cobertura invalido"
    },
    {
      "code": 6008,
      "name": "insufficientPoolCapital",
      "msg": "Liquidez insuficiente no pool para garantir a cobertura"
    },
    {
      "code": 6009,
      "name": "policyNotActive",
      "msg": "A apolice nao esta ativa"
    },
    {
      "code": 6010,
      "name": "outsideCoveragePeriod",
      "msg": "A apolice esta fora do periodo de vigencia"
    },
    {
      "code": 6011,
      "name": "claimAlreadyOpen",
      "msg": "Ja existe um sinistro em aberto para esta apolice"
    },
    {
      "code": 6012,
      "name": "claimTypeNotCovered",
      "msg": "O plano contratado nao cobre este tipo de sinistro"
    },
    {
      "code": 6013,
      "name": "claimExceedsCoverage",
      "msg": "Valor solicitado excede o limite de cobertura restante"
    },
    {
      "code": 6014,
      "name": "claimNotPending",
      "msg": "O sinistro nao esta pendente"
    },
    {
      "code": 6015,
      "name": "claimNotApproved",
      "msg": "O sinistro nao esta aprovado"
    },
    {
      "code": 6016,
      "name": "alreadyVoted",
      "msg": "Avaliador ja votou neste sinistro"
    },
    {
      "code": 6017,
      "name": "notAssessor",
      "msg": "Assinante nao e um avaliador do pool"
    },
    {
      "code": 6018,
      "name": "policyStillActive",
      "msg": "A apolice ainda esta vigente"
    },
    {
      "code": 6019,
      "name": "openClaimBlocksSettlement",
      "msg": "Sinistro em aberto impede a liquidacao da apolice"
    },
    {
      "code": 6020,
      "name": "insufficientShares",
      "msg": "Saldo de cotas insuficiente"
    },
    {
      "code": 6021,
      "name": "withdrawCooldown",
      "msg": "Periodo de carencia de saque ainda nao terminou"
    },
    {
      "code": 6022,
      "name": "withdrawBreaksSolvency",
      "msg": "Saque deixaria o pool abaixo do colateral minimo"
    },
    {
      "code": 6023,
      "name": "faucetLimit",
      "msg": "Valor acima do limite do faucet"
    },
    {
      "code": 6024,
      "name": "zeroAmount",
      "msg": "Quantidade deve ser maior que zero"
    },
    {
      "code": 6025,
      "name": "votingClosed",
      "msg": "Periodo de votacao encerrado"
    },
    {
      "code": 6026,
      "name": "votingStillOpen",
      "msg": "Periodo de votacao ainda em andamento"
    },
    {
      "code": 6027,
      "name": "vehicleAlreadyInsured",
      "msg": "Este veiculo ja possui uma apolice ativa"
    },
    {
      "code": 6028,
      "name": "plateHashMismatch",
      "msg": "Hash da placa nao confere com a placa informada"
    },
    {
      "code": 6029,
      "name": "claimWaitingPeriod",
      "msg": "Sinistro dentro do periodo de carencia da apolice"
    },
    {
      "code": 6030,
      "name": "assessorConflict",
      "msg": "Avaliador nao pode votar ou vistoriar a propria apolice"
    },
    {
      "code": 6031,
      "name": "policyNotInspected",
      "msg": "A apolice ainda nao passou pela vistoria"
    },
    {
      "code": 6032,
      "name": "alreadyInspected",
      "msg": "A vistoria desta apolice ja foi realizada"
    }
  ],
  "types": [
    {
      "name": "claim",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "claimant",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "claimKind"
              }
            }
          },
          {
            "name": "amountRequested",
            "type": "u64"
          },
          {
            "name": "payoutAmount",
            "type": "u64"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "evidenceUri",
            "docs": [
              "URI das evidencias (IPFS/Arweave) ou hash sha256 das fotos."
            ],
            "type": "string"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "claimStatus"
              }
            }
          },
          {
            "name": "approvals",
            "type": "u8"
          },
          {
            "name": "rejections",
            "type": "u8"
          },
          {
            "name": "voters",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "createdTs",
            "type": "i64"
          },
          {
            "name": "votingDeadline",
            "type": "i64"
          },
          {
            "name": "resolvedTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "claimFiled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "claim",
            "type": "pubkey"
          },
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "claimant",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "claimKind"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "claimKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "theft"
          },
          {
            "name": "collision"
          },
          {
            "name": "thirdParty"
          },
          {
            "name": "naturalEvent"
          },
          {
            "name": "other"
          }
        ]
      }
    },
    {
      "name": "claimPaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "claim",
            "type": "pubkey"
          },
          {
            "name": "claimant",
            "type": "pubkey"
          },
          {
            "name": "payout",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "claimStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "approved"
          },
          {
            "name": "rejected"
          },
          {
            "name": "paid"
          }
        ]
      }
    },
    {
      "name": "claimVoted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "claim",
            "type": "pubkey"
          },
          {
            "name": "assessor",
            "type": "pubkey"
          },
          {
            "name": "approve",
            "type": "bool"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "claimStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "coverageTier",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "basic"
          },
          {
            "name": "standard"
          },
          {
            "name": "premium"
          }
        ]
      }
    },
    {
      "name": "fileClaimArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "claimKind"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "evidenceUri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "liquidityDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "liquidityWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "policy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "plate",
            "type": "string"
          },
          {
            "name": "plateHash",
            "docs": [
              "sha256 da placa normalizada: chave do registro unico do veiculo."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "model",
            "type": "string"
          },
          {
            "name": "year",
            "type": "u16"
          },
          {
            "name": "vehicleValue",
            "docs": [
              "Valor FIPE em unidades do token (6 casas decimais)."
            ],
            "type": "u64"
          },
          {
            "name": "tier",
            "type": {
              "defined": {
                "name": "coverageTier"
              }
            }
          },
          {
            "name": "durationDays",
            "type": "u16"
          },
          {
            "name": "premiumPaid",
            "type": "u64"
          },
          {
            "name": "coverageLimit",
            "type": "u64"
          },
          {
            "name": "deductible",
            "type": "u64"
          },
          {
            "name": "cashbackAmount",
            "type": "u64"
          },
          {
            "name": "startTs",
            "type": "i64"
          },
          {
            "name": "endTs",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "policyStatus"
              }
            }
          },
          {
            "name": "claimsFiled",
            "type": "u8"
          },
          {
            "name": "hasOpenClaim",
            "type": "bool"
          },
          {
            "name": "hadPaidClaim",
            "docs": [
              "Verdadeiro se algum sinistro foi pago (perde o cashback)."
            ],
            "type": "bool"
          },
          {
            "name": "totalPaidOut",
            "type": "u64"
          },
          {
            "name": "cashbackRedeemed",
            "type": "bool"
          },
          {
            "name": "inspected",
            "docs": [
              "Vistoria previa feita por um avaliador (exigida antes de sinistros)."
            ],
            "type": "bool"
          },
          {
            "name": "inspector",
            "type": "pubkey"
          },
          {
            "name": "claimsAllowedFrom",
            "docs": [
              "Primeiro instante em que um sinistro e aceito (inicio + carencia)."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "policyInspected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "inspector",
            "type": "pubkey"
          },
          {
            "name": "approved",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "policyPurchased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "tier",
            "type": {
              "defined": {
                "name": "coverageTier"
              }
            }
          },
          {
            "name": "premium",
            "type": "u64"
          },
          {
            "name": "coverageLimit",
            "type": "u64"
          },
          {
            "name": "endTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "policySettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "cashbackPaid",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "policyStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "settled"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "pool",
      "docs": [
        "Pool de risco mutualista. Os provedores de liquidez (stakers) aportam capital",
        "que garante as coberturas; os premios pagos pelos motoristas remuneram esse capital."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "stableMint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "totalShares",
            "docs": [
              "Total de cotas emitidas aos provedores de liquidez."
            ],
            "type": "u64"
          },
          {
            "name": "totalActiveCoverage",
            "docs": [
              "Soma dos limites de cobertura das apolices ativas."
            ],
            "type": "u64"
          },
          {
            "name": "reservedCashback",
            "docs": [
              "Cashback reservado para devolucao a motoristas sem sinistro."
            ],
            "type": "u64"
          },
          {
            "name": "pendingClaims",
            "docs": [
              "Soma dos valores solicitados em sinistros pendentes/aprovados ainda nao pagos."
            ],
            "type": "u64"
          },
          {
            "name": "totalPremiums",
            "type": "u64"
          },
          {
            "name": "totalClaimsPaid",
            "type": "u64"
          },
          {
            "name": "totalCashbackPaid",
            "type": "u64"
          },
          {
            "name": "policyCount",
            "type": "u64"
          },
          {
            "name": "claimCount",
            "type": "u64"
          },
          {
            "name": "activePolicies",
            "type": "u64"
          },
          {
            "name": "params",
            "type": {
              "defined": {
                "name": "poolParams"
              }
            }
          },
          {
            "name": "assessors",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "approvalThreshold",
            "type": "u8"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "poolInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "stableMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "poolParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseRateBps",
            "docs": [
              "Taxa anual base sobre o valor FIPE (bps). Ex: 350 = 3,5% ao ano."
            ],
            "type": "u16"
          },
          {
            "name": "cashbackBps",
            "docs": [
              "Parte do premio devolvida ao motorista se nao houver sinistro (bps)."
            ],
            "type": "u16"
          },
          {
            "name": "minCollateralBps",
            "docs": [
              "Colateral minimo exigido sobre a cobertura ativa total (bps)."
            ],
            "type": "u16"
          },
          {
            "name": "withdrawCooldownSecs",
            "docs": [
              "Carencia minima entre deposito e saque de liquidez (segundos)."
            ],
            "type": "i64"
          },
          {
            "name": "claimVotingSecs",
            "docs": [
              "Janela de votacao dos avaliadores (segundos)."
            ],
            "type": "i64"
          },
          {
            "name": "secondsPerDay",
            "docs": [
              "Duracao de um \"dia\" de apolice em segundos. 86400 em producao;",
              "valores menores permitem demonstrar o ciclo completo em devnet."
            ],
            "type": "i64"
          },
          {
            "name": "claimWaitingSecs",
            "docs": [
              "Carencia entre a contratacao e o primeiro sinistro aceito (segundos).",
              "Evita contratar a apolice depois que o evento ja aconteceu."
            ],
            "type": "i64"
          },
          {
            "name": "faucetEnabled",
            "docs": [
              "Habilita o faucet de token de teste (somente devnet/localnet)."
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "purchasePolicyArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "docs": [
              "Nonce escolhido pelo cliente para derivar o PDA da apolice."
            ],
            "type": "u64"
          },
          {
            "name": "plate",
            "type": "string"
          },
          {
            "name": "plateHash",
            "docs": [
              "sha256 da placa normalizada (maiusculas, so letras e digitos)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "model",
            "type": "string"
          },
          {
            "name": "year",
            "type": "u16"
          },
          {
            "name": "vehicleValue",
            "type": "u64"
          },
          {
            "name": "tier",
            "type": {
              "defined": {
                "name": "coverageTier"
              }
            }
          },
          {
            "name": "durationDays",
            "type": "u16"
          },
          {
            "name": "maxPremium",
            "docs": [
              "Protecao contra slippage: premio maximo aceito pelo usuario."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "stakePosition",
      "docs": [
        "Posicao de um provedor de liquidez (staker) no pool."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "totalDeposited",
            "type": "u64"
          },
          {
            "name": "totalWithdrawn",
            "type": "u64"
          },
          {
            "name": "lastDepositTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vehicleRecord",
      "docs": [
        "Registro unico por veiculo (placa): garante no maximo uma apolice ativa,",
        "impedindo segurar o mesmo carro varias vezes para multiplicar a indenizacao."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "plateHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "activePolicy",
            "docs": [
              "Apolice ativa atual; `Pubkey::default()` quando livre."
            ],
            "type": "pubkey"
          },
          {
            "name": "policiesCount",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
