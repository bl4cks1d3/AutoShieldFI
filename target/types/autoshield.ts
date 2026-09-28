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
      "name": "acceptAuthority",
      "discriminator": [
        107,
        86,
        198,
        91,
        33,
        12,
        107,
        160
      ],
      "accounts": [
        {
          "name": "newAuthority",
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
        }
      ],
      "args": []
    },
    {
      "name": "applyAssessors",
      "discriminator": [
        71,
        183,
        123,
        156,
        211,
        109,
        24,
        179
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
          }
        }
      ],
      "args": []
    },
    {
      "name": "applyParams",
      "discriminator": [
        188,
        203,
        86,
        124,
        178,
        34,
        133,
        116
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
          }
        }
      ],
      "args": []
    },
    {
      "name": "cancelPending",
      "discriminator": [
        74,
        87,
        109,
        242,
        64,
        192,
        151,
        71
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
      "args": []
    },
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
          "name": "program",
          "address": "GPnGSA7KH3vqnF1KfzHGzQNvnEBVD3XRfCayEBhQsuRC"
        },
        {
          "name": "programData"
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
          "name": "assessorToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "assessor"
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
      "name": "payInstallment",
      "discriminator": [
        214,
        118,
        104,
        215,
        242,
        93,
        33,
        60
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
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "proposeAssessors",
      "discriminator": [
        170,
        44,
        47,
        63,
        216,
        123,
        239,
        31
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
      "name": "proposeAuthority",
      "discriminator": [
        20,
        148,
        236,
        198,
        76,
        119,
        99,
        142
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
      "name": "proposeParams",
      "docs": [
        "Governanca com timelock: propor, aguardar `governance_delay_secs`, aplicar."
      ],
      "discriminator": [
        94,
        141,
        220,
        182,
        171,
        53,
        52,
        182
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
          "name": "assessorToken",
          "docs": [
            "Recebe a remuneracao pelo voto (paga da tesouraria do protocolo)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "assessor"
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
    },
    {
      "name": "withdrawTreasury",
      "discriminator": [
        40,
        63,
        122,
        158,
        144,
        216,
        83,
        96
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
          "name": "destination",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
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
      "name": "assessorPaid",
      "discriminator": [
        150,
        79,
        217,
        28,
        187,
        106,
        147,
        3
      ]
    },
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
      "name": "governanceChangeApplied",
      "discriminator": [
        36,
        17,
        46,
        195,
        7,
        15,
        140,
        117
      ]
    },
    {
      "name": "governanceChangeProposed",
      "discriminator": [
        83,
        12,
        252,
        70,
        81,
        10,
        135,
        101
      ]
    },
    {
      "name": "installmentPaid",
      "discriminator": [
        247,
        32,
        44,
        43,
        84,
        76,
        215,
        84
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
    },
    {
      "name": "treasuryWithdrawn",
      "discriminator": [
        143,
        181,
        157,
        169,
        87,
        155,
        170,
        46
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
    },
    {
      "code": 6033,
      "name": "invalidInstallments",
      "msg": "Numero de parcelas invalido para a vigencia escolhida"
    },
    {
      "code": 6034,
      "name": "alreadyFullyPaid",
      "msg": "Todas as parcelas desta apolice ja foram pagas"
    },
    {
      "code": 6035,
      "name": "policyLapsed",
      "msg": "Apolice caducada por parcela em atraso"
    },
    {
      "code": 6036,
      "name": "noPendingChange",
      "msg": "Nao ha mudanca de governanca pendente"
    },
    {
      "code": 6037,
      "name": "timelockActive",
      "msg": "Timelock de governanca ainda nao expirou"
    },
    {
      "code": 6038,
      "name": "notPendingAuthority",
      "msg": "Assinante nao e a autoridade proposta"
    },
    {
      "code": 6039,
      "name": "insufficientTreasury",
      "msg": "Saldo insuficiente na tesouraria do protocolo"
    },
    {
      "code": 6040,
      "name": "firstDepositTooSmall",
      "msg": "Primeiro aporte abaixo do minimo"
    },
    {
      "code": 6041,
      "name": "insufficientLiquidityForClaim",
      "msg": "Liquidez livre insuficiente para pagar o sinistro agora"
    }
  ],
  "types": [
    {
      "name": "assessorPaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "assessor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "kind",
            "docs": [
              "0 = vistoria, 1 = voto em sinistro."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "claim",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
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
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
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
      "name": "governanceChangeApplied",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "governanceChangeProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "docs": [
              "0 = parametros, 1 = avaliadores."
            ],
            "type": "u8"
          },
          {
            "name": "eta",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "installmentPaid",
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
            "name": "number",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "paidUntil",
            "type": "i64"
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
            "name": "version",
            "type": "u8"
          },
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
            "name": "premiumTotal",
            "docs": [
              "Premio total da vigencia (soma de todas as parcelas)."
            ],
            "type": "u64"
          },
          {
            "name": "premiumPaid",
            "docs": [
              "Quanto do premio ja foi pago."
            ],
            "type": "u64"
          },
          {
            "name": "installments",
            "type": "u8"
          },
          {
            "name": "installmentsPaid",
            "type": "u8"
          },
          {
            "name": "installmentPeriod",
            "docs": [
              "Intervalo entre parcelas (segundos)."
            ],
            "type": "i64"
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
            "docs": [
              "Cashback reservado ate agora (cresce a cada parcela paga)."
            ],
            "type": "u64"
          },
          {
            "name": "protocolFeesPaid",
            "docs": [
              "Taxa do protocolo ja cobrada desta apolice (estornada se a vistoria for recusada)."
            ],
            "type": "u64"
          },
          {
            "name": "inspectionFee",
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
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
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
            "name": "version",
            "type": "u8"
          },
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
              "Total de cotas emitidas (inclui as cotas \"mortas\" do primeiro aporte)."
            ],
            "type": "u64"
          },
          {
            "name": "totalActiveCoverage",
            "docs": [
              "Soma das coberturas restantes das apolices ativas."
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
            "name": "treasuryAccrued",
            "docs": [
              "Taxa do protocolo acumulada no cofre (receita, fora do patrimonio dos LPs)."
            ],
            "type": "u64"
          },
          {
            "name": "pendingInspectionFees",
            "docs": [
              "Taxas de vistoria pagas pelos motoristas e ainda nao repassadas ao avaliador."
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
            "name": "totalProtocolFees",
            "type": "u64"
          },
          {
            "name": "totalAssessorRewards",
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
            "name": "pendingParams",
            "docs": [
              "Governanca com timelock: mudancas propostas so valem apos `*_eta`."
            ],
            "type": {
              "option": {
                "defined": {
                  "name": "poolParams"
                }
              }
            }
          },
          {
            "name": "pendingParamsEta",
            "type": "i64"
          },
          {
            "name": "pendingAssessors",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "pendingThreshold",
            "type": "u8"
          },
          {
            "name": "pendingAssessorsEta",
            "type": "i64"
          },
          {
            "name": "pendingAuthority",
            "docs": [
              "Transferencia de autoridade em dois passos (proposta + aceite)."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                128
              ]
            }
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
            "name": "protocolFeeBps",
            "docs": [
              "Parte do premio que fica com o protocolo (bps)."
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
              "Carencia entre a contratacao e o primeiro sinistro aceito (segundos)."
            ],
            "type": "i64"
          },
          {
            "name": "installmentGraceSecs",
            "docs": [
              "Tolerancia para pagar uma parcela vencida antes da apolice caducar (segundos)."
            ],
            "type": "i64"
          },
          {
            "name": "governanceDelaySecs",
            "docs": [
              "Atraso minimo entre propor e aplicar mudancas de governanca (segundos)."
            ],
            "type": "i64"
          },
          {
            "name": "inspectionFee",
            "docs": [
              "Taxa de vistoria paga pelo motorista na contratacao; vai para o avaliador,",
              "mesmo se a vistoria for recusada (desestimula contratacoes abusivas)."
            ],
            "type": "u64"
          },
          {
            "name": "voteReward",
            "docs": [
              "Remuneracao por voto em sinistro, paga da tesouraria do protocolo."
            ],
            "type": "u64"
          },
          {
            "name": "minVehicleValue",
            "docs": [
              "Valor FIPE minimo aceito."
            ],
            "type": "u64"
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
            "name": "installments",
            "docs": [
              "1 = a vista; ate 12 parcelas, cada uma cobrindo ao menos 30 dias."
            ],
            "type": "u8"
          },
          {
            "name": "maxPremium",
            "docs": [
              "Protecao contra slippage: premio total maximo aceito pelo usuario."
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
            "name": "version",
            "type": "u8"
          },
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
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "treasuryWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vehicleRecord",
      "docs": [
        "Registro unico por veiculo (placa): garante no maximo uma apolice ativa e",
        "vistoriada, impedindo segurar o mesmo carro varias vezes."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
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
              "Apolice vistoriada e ativa; `Pubkey::default()` quando livre."
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
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    }
  ]
};
