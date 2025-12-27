// 📊 Resumo das atividades
// Endpoint	Descrição
// GET /summary	Mostra próximas revisões, lições e estado atual (resumo)
// 📚 Materiais de estudo e assuntos
// Endpoint	Descrição
// GET /subjects	Lista todos os “subjects” (radicais, kanji, vocabulário)
// GET /subjects/:id	Mostra um subject específico por ID
// 📘 Status e progresso
// Endpoint	Descrição
// GET /assignments	Estado de SRS (níveis, unlocked/passed/burned, etc.)
// GET /assignments/:id	Um assignment específico
// 📈 Progressão de níveis
// Endpoint	Descrição
// GET /level_progressions	Histórico de subida de níveis
// GET /level_progressions/:id	Progressão específica
// 📊 Estatísticas
// Endpoint	Descrição
// GET /review_statistics	Estatísticas de revisão por subject
// 📚 Material de Estudo
// Endpoint	Descrição
// GET /study_materials	Notas e sinônimos personalizadas do usuário
// GET /study_materials/:id	Informação específica de estudo
// POST /study_materials	Criar material de estudo (se permissão escrita liberada)
// PUT /study_materials/:id	Atualizar material de estudo
// 📌 Outros recursos gerais
// Endpoint	Descrição
// GET /voice_actors	Lista de dubladores (metadata geral)
// GET /voice_actors/:id	Dublador específico

class WaniKaniFetcher {
    constructor(apiKey, endpoints, type = 'GET') {
        this.apiKey = apiKey;
        this.endpoints = endpoints;
        this.baseURL = 'https://api.wanikani.com/v2/';
        this.results = {};
        this.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Wanikani-Revision': '20170710'
        };
        this.type = type;
    }

    async init() {
        if (this.type === 'GET') {
            return await this.fetchAll();
        }
        return null;
    }

    async fetchAll() {
        try {
            const promises = this.endpoints.map(async (endpoint) => {
                if (endpoint.includes(':id')) {
                    this.results[endpoint] = null;
                    return;
                }
                const response = await fetch(`${this.baseURL}${endpoint}`, { headers: this.headers });
                const data = await response.json();
                this.results[endpoint] = data;
            });

            await Promise.all(promises);
            return this.results;
        } catch (error) {
            console.error('Error fetching endpoints:', error);
            return { error: error.message };
        }
    }
}

module.exports = WaniKaniFetcher;
