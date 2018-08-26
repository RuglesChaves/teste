'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
	versao: String,
	app: {
		// acionamento: {
		// 	ao_criar_ticket: { type: Boolean, default: false },
		// 	ao_fazer_pagamento: { type: Boolean, default: false }
		// },
		backup: {
			root: {type: String, default: '../backup/database/'},
			frequencia: Number, // em horas
			tempo_limite_armazenamento: Number, // em dias
			ftp: {
				ativo: Boolean,
				endereco: String,
				porta: Number,
				usuario: String,
				senha: String
			}
		},
		entrada_offline: Boolean,
		tamanho_impressao: Number,
		validar_cpf_cnpj: Boolean,
		validar_cpf_cnpj_duplicados: Boolean,
		nota_fiscal: {
			usuario: String,
			senha: String,
			cnae: String,
			codigo_item_lista_servico: String,
			codigo_cnae: String,
			codigo_tributacao_municipio: String,
			codigo_cidade: Number,
			codigo_municipio: Number,
			contingencia: { type: Boolean, default: false },
			emissao_automatica: { type: Boolean, default: true },
			numero: { type: Number, default: 0 },
			ativo: { type: Boolean, default: false },
			url: String,
	    	csc: String, // CSC - Código de Segurança do Contribuinte (antigo Token)
    		identificador_csc: String, // https://online.sefaz.am.gov.br/inicioDte.asp
			certificado: {
				arquivo: String, // Certificado TSM 2016.pfx
				senha: String,  // j39c789t
			},
	  		pis: { type: String, default: '0,00' },
	  		cofins: { type: String, default: '0,00' },
	  		iss: { type: String, default: '0,00' },
			serie: Number,
			ambiente: String,
			codigo_item_lista_servico: String,
			cnae: String,
			codigo_tributacao_municipio: String,
			descricao_servico: String
		},
		email: {
			email: String,
			senha: String,
			servidor: String,
			porta: Number
		}
	},
	patio: {
		quantidade_vagas: Number,
		bloquear_excedente: { type: Boolean, default: false },
	},
	versoes: {
		versao: String,
		data_atualizacao: String
	},
	ticket: {
		linha1: { type: String, uppercase: true },
		linha2: { type: String, uppercase: true },
		linha3: { type: String, uppercase: true },
		linha4: { type: String, uppercase: true },
		linha5: { type: String, uppercase: true },
		linha6: { type: String, uppercase: true }
	},
	empresa: {
	    // logo: { data: Buffer, contentType: String },
		regime_especial_tributacao: { type: String },
		municipio: { type: String, uppercase: true }, 
    	razao_social: { type: String, uppercase: true },
    	nome_fantasia: { type: String, uppercase: true },
    	cnpj: String,
    	inscricao_estadual: String,
    	inscricao_municipal: String,
    	regime_tributario: String,
    	telefone1: String,
    	telefone2: String,
    	telefone3: String,
    	cep: String,
    	endereco: { type: String, uppercase: true },
    	complemento: { type: String, uppercase: true },
    	numero: { type: String, uppercase: true },
    	bairro: { type: String, uppercase: true },
    	cidade: { type: String, uppercase: true },
    	estado: { type: String, uppercase: true },
    	responsavel: { type: String, uppercase: true },
  		data_cadastro: { type: Date, default: Date.now },
	},
	mensagem: {
		acesso_liberado_linha1: { type: String, uppercase: true },
		acesso_liberado_linha2: { type: String, uppercase: true },
		acesso_negado_linha1: { type: String, uppercase: true },
		acesso_negado_linha2: { type: String, uppercase: true },
		sucesso_impressao_linha1: { type: String, uppercase: true },
		sucesso_impressao_linha2: { type: String, uppercase: true },
		entrada_liberado_linha1: { type: String, uppercase: true },
		entrada_liberado_linha2: { type: String, uppercase: true },

		estacionamento_lotado_linha1: { type: String, uppercase: true },
		estacionamento_lotado_linha2: { type: String, uppercase: true },
		cliente_sem_vagas_linha1: { type: String, uppercase: true },
		cliente_sem_vagas_linha2: { type: String, uppercase: true },
		entrada_duplicada_linha1: { type: String, uppercase: true },
		entrada_duplicada_linha2: { type: String, uppercase: true },

		entrada_bloqueada_inadimplencia_mensalista_linha1: { type: String, uppercase: true },
		entrada_bloqueada_inadimplencia_mensalista_linha2: { type: String, uppercase: true },

		saldo_insuficiente_linha2: { type: String, uppercase: true },		

	}
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('configuracao', schema);

module.exports = Model;

/*
	var schema = new Schema({
	  name:    String,
	  binary:  Buffer,
	  living:  Boolean,
	  updated: { type: Date, default: Date.now }
	  age:     { type: Number, min: 18, max: 65 }
	  mixed:   Schema.Types.Mixed,
	  _someId: Schema.Types.ObjectId,
	  array:      [],
	  ofString:   [String],
	  ofNumber:   [Number],
	  ofDates:    [Date],
	  ofBuffer:   [Buffer],
	  ofBoolean:  [Boolean],
	  ofMixed:    [Schema.Types.Mixed],
	  ofObjectId: [Schema.Types.ObjectId],
	  nested: {
	    stuff: { type: String, lowercase: true, trim: true }
	  }
	})
*/
