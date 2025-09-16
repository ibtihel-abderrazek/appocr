const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Traitement de Fichiers et OCR',
      version: '1.0.0',
      description: 'Documentation de l\'API pour le traitement de fichiers PDF, OCR et gestion des patches',
      contact: {
        name: 'Support API',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Serveur de développement',
      }
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string'
            },
            message: {
              type: 'string'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            message: {
              type: 'string'
            }
          }
        },
        Profile: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Nom du profil'
            },
            config: {
              type: 'object',
              description: 'Configuration du profil'
            }
          }
        },
        Scanner: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Identifiant du scanner'
            },
            name: {
              type: 'string',
              description: 'Nom du scanner'
            },
            status: {
              type: 'string',
              enum: ['available', 'busy', 'offline']
            }
          }
        },
        PatchSplitRequest: {
          type: 'object',
          required: ['pdfPath'],
          properties: {
            pdfPath: {
              type: 'string',
              description: 'Chemin vers le fichier PDF'
            },
            patchMode: {
              type: 'string',
              description: 'Mode de découpage par patch'
            },
            lang: {
              type: 'string',
              description: 'Langue pour l\'OCR'
            },
            naming: {
              type: 'string',
              description: 'Convention de nommage'
            },
            namingPattern: {
              type: 'string',
              description: 'Motif de nommage'
            },
            ocrMode: {
              type: 'string',
              description: 'Mode OCR (true/false)'
            },
            containsPatch: {
              type: 'string',
              description: 'Contient des patches (true/false)'
            }
          }
        },
        PatchSplitResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  filename: {
                    type: 'string'
                  },
                  path: {
                    type: 'string'
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  // Chemins vers vos fichiers de routes
  apis: ['./index.js', './routes/*.js'],
};

const specs = swaggerJsdoc(options);

const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',
    defaultModelRendering: 'model'
  },
  customCss: `
    .swagger-ui .topbar { 
      background-color: #1a73e8; 
    }
  `,
  customSiteTitle: "API Documentation - Traitement de Fichiers"
};

module.exports = {
  swaggerUi,
  specs,
  swaggerOptions
};