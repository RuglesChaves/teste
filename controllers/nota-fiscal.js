'use strict';

var moment = require('moment');
var asyncLoop = require('node-async-loop');
var helper = require('../config/helper');
var fetch = require('node-fetch');

// require default controller
var controller = require('../controllers/controller');

//Models
var Configuracao = require('../models/configuracao');
var Pagamento = require('../models/pagamento');

// creating a new controller object
var Controller = new controller({
	route			: 'nota-fiscal',
	menu			: 'Relatórios',
	pageName		: 'Nota Fiscal',
	pageNamePlural	: 'Notas Fiscais',
	model  			: 'pagamento'
});

Controller.customRoutes = function (app) {
	app.get('/nota-fiscal/enviar/:id', this.autentication(), this.enviar());
}

Controller.enviar = function(){
	return function(req, res, next) {
		Controller.enviarTecnoSpeed(req.params.id, function(err, message){
			console.log('entrou aqui');
			console.log(err);
		
			req.flash(err, message);
			res.redirect(req.headers.referer);
		});
	}		
};

Controller.startNotes = function(){
	setInterval(function(){ 
		var filter = {
			'excluido.data': null,
			'nota_fiscal.status': 'AGUARDANDO ENVIO'
		};
		Pagamento.paginate(filter, {page: 1, limit: 50}, function(err, result) {
			console.log('=====================================================================');
			console.log('PAGAMENTOS CAPTURADOS: '+result.docs.length);
			if(result.docs.length > 0){
				asyncLoop(result.docs, function (item, next){
					Controller.enviarTecnoSpeed(item._id, function(err, message) {
						next();
					});
				}, function (err){
					if (err)
						return console.log('Error: ' + err.message);
					console.log('Finalizado!');
				});
			}
		});
	 }, 900000 //15min
	);
}

Controller.seeStatus = function(){
	setInterval(function(){ 
		Configuracao.findOne({}, function(err, configuracao){
			var filter = {
				'excluido.data': null,
				'nota_fiscal.status': 'ENVIADO',
				'nota_fiscal.observacao':  {$ne: null, $exists: true}
			};
			Pagamento.find(filter, function(err, pagamentos){
				if(!err && pagamentos && pagamentos.length > 0){
					if(configuracao.app.nota_fiscal.ambiente === "Produção") {
						var apiRoute = "https://managersaas.tecnospeed.com.br:8081/ManagerAPIWeb/nfse/consulta?";
						var usuario = configuracao.app.nota_fiscal.usuario;
						var senha = configuracao.app.nota_fiscal.senha;
						var grupo = 'TOTALSEG';
						var cnpj = helper.removerCaracteresEspeciais(configuracao.empresa.cnpj);
					} else {
						var apiRoute = "https://managersaashom.tecnospeed.com.br:7071/ManagerAPIWeb/nfse/consulta?";
						var usuario = 'admin';
						var senha = '123mudar';
						var grupo = 'edoc';
						var cnpj = '08187168000160';
					}
					
					var URL = apiRoute + `grupo=${grupo}&cnpj=${cnpj}&campos=nrps,nnfse,dtemissao,situacao,motivo&Filtro=nrps=`
	
					var querystring = require('querystring');
	
	
					var headers = {
						Authorization: 'Basic ' + new Buffer(usuario+':'+senha).toString('base64'),
					}
					
					console.log('=====================================================================');
					console.log('api route: '+apiRoute);
					console.log('usuario: '+usuario);
					console.log('senha: '+senha);
					console.log('headers:');
					console.log(headers); 
	
					asyncLoop(pagamentos, function (item, next){
						fetch(URL+item.nota_fiscal.rps, {
							method: 'GET',
							body: null,
							headers: headers,
						}).then(res => res.text()).then(function(res) {
							console.log('=====================================================================');
							console.log('RESPOSTA:');
							console.log(res);
							res = res.split(',');
							if(res.length === 5 && res[3] === 'AUTORIZADA'){
								item = item.toObject();
								item.nota_fiscal.status = 'EMITIDO';
								item.nota_fiscal.numero = res[1];
								item.nota_fiscal.observacao = res[4];
								item.nota_fiscal.data_envio = moment(res[2], 'DD/MM/YYYY').toISOString()
	
								Pagamento.findOneAndUpdate({_id: item._id}, item, function(err, result){
									if(err){
										console.log('=====================================================================');
										console.log('ERRO AO ATUALIZAR PAGAMENTO:');
										console.log(err);
									}
									next();
								});
							}else{
								next();
							}
						
						}).catch(err => console.error(err)); 	
					}, function (err){
						if (err)
							return console.log('Error: ' + err.message);
						console.log('Finalizado!');
					});
	
				}else{
					console.log('Erro no banco de dados, ou não pagamentos com notas pendentes.')
				}
			});
		});
	 }, 1800000 //30min 1680000 -> 28min
	);
	
}
			
Controller.enviarTecnoSpeed = function(idPagamento, callback){
	Configuracao.findOne({}, function(err, configuracao){
			Pagamento.findOne({_id: idPagamento}, function(err, pagamento){

			if(!err && pagamento){
			var totalImposto = helper.moeda2float(pagamento.nota_fiscal.total_impostos);
				pagamento = pagamento.toObject();

				

			if(configuracao.app.nota_fiscal.ambiente === "Produção") {
				var apiRoute = "https://managersaas.tecnospeed.com.br:8081/ManagerAPIWeb/nfse/envia";
				var usuario = configuracao.app.nota_fiscal.usuario;
				var senha = configuracao.app.nota_fiscal.senha;
				var grupo = 'TOTALSEG';
				var cnpj = helper.removerCaracteresEspeciais(configuracao.empresa.cnpj);
				var cidade = helper.removeAcento(configuracao.empresa.cidade);
			} else {
				var apiRoute = "https://managersaashom.tecnospeed.com.br:7071/ManagerAPIWeb/nfse/envia";
				//var apiRoute = 'https://postman-echo.com/post';
				var usuario = 'admin';
				var senha = '123mudar';
				var grupo = 'edoc';
				var cnpj = '08187168000160';
				var cidade = 'Maringa';
			}


var templateTx2 = `NomeCidade=${helper.removeAcento(cidade)}PA
formato=tx2
padrao=TecnoNFSe

INCLUIR
IdLote=
NumeroLote=${Math.floor(Math.random()*99999999999999+3)}
CpfCnpjRemetente=${cnpj}
InscricaoMunicipalRemetente=${configuracao.empresa.inscricao_municipal}
RazaoSocialRemetente=${configuracao.empresa.razao_social}
QuantidadeRps=1
CodigoCidadeRemetente=${configuracao.app.nota_fiscal.codigo_cidade}
Transacao=1
DataInicio=${helper.dataTecnospeed(pagamento.data_pagamento)}
Versao=3.10
ValorTotalServicos=${helper.moeda2float(pagamento.valor)}
ValorTotalDeducoes=${(totalImposto*(helper.moeda2float(pagamento.valor)/100))}
ValorTotalBaseCalculo=${helper.porcentagem(helper.moeda2float(pagamento.valor), totalImposto)}
SALVAR

INCLUIRRPS
DataEmissao=${helper.dataTecnospeed()}
IdRps=
NumeroRps=${pagamento.nota_fiscal.rps}
SerieRps=${configuracao.app.nota_fiscal.serie}
TipoRps=1
OptanteSimplesNacional=${configuracao.empresa.regime_tributario === "Regime Normal" ? 2 : 1}
IncentivadorCultural=2
ExigibilidadeISS=1
IncentivoFiscal=2
SituacaoNota=1
TipoTributacao=1
NaturezaTributacao=1
RegimeEspecialTributacao=0

ValorServicos=${helper.moeda2float(pagamento.valor)}
ValorDeducoes=${(totalImposto*(helper.moeda2float(pagamento.valor)/100))}
ValorPis=${configuracao.app.nota_fiscal.pis ? helper.moeda2float(configuracao.app.nota_fiscal.pis)*(helper.moeda2float(pagamento.valor)/100) : '0,00'}
ValorCofins=${configuracao.app.nota_fiscal.cofins ? helper.moeda2float(configuracao.app.nota_fiscal.cofins)*(helper.moeda2float(pagamento.valor)/100) : '0,00'}
ValorInss=0.00
ValorIr=0.00
ValorCsll=0.00
IssRetido=2
ValorIss=${configuracao.app.nota_fiscal.iss ? helper.moeda2float(configuracao.app.nota_fiscal.iss)*(helper.moeda2float(pagamento.valor)/100) : '0,00'}
ValorIssRetido=0.00
BaseCalculo=0
ValorLiquidoNfse=${helper.moeda2float(pagamento.valor)}
DescontoIncondicionado=0.00
DescontoCondicionado=0.00
AliquotaISS=${helper.moeda2float(configuracao.app.nota_fiscal.iss)}
AliquotaPIS=${helper.moeda2float(configuracao.app.nota_fiscal.pis)}
AliquotaCOFINS=${helper.moeda2float(configuracao.app.nota_fiscal.cofins)}
AliquotaINSS=0
AliquotaIR=0
AliquotaCSLL=0
CodigoItemListaServico=${configuracao.app.nota_fiscal.codigo_item_lista_servico}
CodigoCnae=${configuracao.app.nota_fiscal.cnae}
CodigoTributacaoMunicipio=${configuracao.app.nota_fiscal.codigo_tributacao_municipio}
DiscriminacaoServico=${helper.removeAcento(configuracao.app.nota_fiscal.descricao_servico)}
CodigoCidadePrestacao=${configuracao.app.nota_fiscal.codigo_cidade}
DescricaoCidadePrestacao=${cidade}

CpfCnpjPrestador=${cnpj}
InscricaoMunicipalPrestador=${configuracao.empresa.inscricao_municipal}
RazaoSocialPrestador=${configuracao.empresa.razao_social}
DDDPrestador=${helper.removerCaracteresEspeciais(configuracao.empresa.telefone1.split(' ')[0])}
TelefonePrestador=${helper.removerCaracteresEspeciais(configuracao.empresa.telefone1.split(' ')[1])}

CpfCnpjTomador=${pagamento.nota_fiscal.cpf_cnpj}
RazaoSocialTomador=
InscricaoMunicipalTomador=
InscricaoEstadualTomador=
TipoLogradouroTomador=
EnderecoTomador=
NumeroTomador=
ComplementoTomador=
TipoBairroTomador=
BairroTomador=
CodigoCidadeTomador=${configuracao.app.nota_fiscal.codigo_cidade}
DescricaoCidadeTomador=
UfTomador=
CepTomador=
DDDTomador=
TelefoneTomador=
EmailTomador=${pagamento.nota_fiscal.email}

PercentualDeduzir=0
QuantidadeServicos=1
ValorUnitarioServico=${helper.moeda2float(pagamento.valor)}
SALVARRPS`;

			var querystring = require('querystring');

			var body = {
				grupo: grupo,
				cnpj: cnpj,
				arquivo: ''
			}

			var headers = {
				Authorization: 'Basic ' + new Buffer(usuario+':'+senha).toString('base64'),
			'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': new Buffer(querystring.stringify(body)+encodeURIComponent(templateTx2).replace(/'/g,"%27").replace(/"/g,"%22")).length
			}
			
			console.log('=====================================================================');
			console.log('api route: '+apiRoute);
			console.log('usuario: '+usuario);
			console.log('senha: '+senha);
			console.log('headers:');
			console.log(headers); 
			console.log('body:');
			console.log(body);
			console.log('=====================================================================');
			console.log('templateTx2');
			console.log(templateTx2);
			
			fetch(apiRoute, {
				method: 'POST',
				body: querystring.stringify(body)+encodeURIComponent(templateTx2).replace(/'/g,"%27").replace(/"/g,"%22"),
				headers: headers,
			}).then(res => res.text()).then(function(res) {
				console.log('=====================================================================');
				console.log('RESPOSTA:');
				console.log(res);
			res = res.split(',');
			if(res[0] !== 'EXCEPTION'){
				pagamento.nota_fiscal.status = 'ENVIADO';
				pagamento.nota_fiscal.numero = res[2];
				pagamento.nota_fiscal.observacao = res[3];
				pagamento.nota_fiscal.data_envio = new Date();

			}else{
				pagamento.nota_fiscal.observacao = res[2];
			}
			
			Pagamento.findOneAndUpdate({_id: idPagamento}, pagamento, function(err, result){
				if(err){
					console.log('=====================================================================');
					console.log('ERRO AO ATUALIZAR PAGAMENTO:');
					console.log(err);
				}
				if(res[0] !== 'EXCEPTION')
					callback('success', pagamento.nota_fiscal.observacao);
				else
					callback('error', pagamento.nota_fiscal.observacao);

			});
		}).catch(err => console.error(err)); 
			}else{
				console.log('Erro ao encontrar pagamento!');
				console.log(err);
			}		

		});
	});
}

Controller.gerarNotaFiscal = function(valor, dadosClienteFormulario, callback) {
	Configuracao.findOne({}, function(err, oldResult){
		if(!err && oldResult){
			oldResult.app.nota_fiscal.numero = oldResult.app.nota_fiscal.numero + 1;
			Configuracao.findOneAndUpdate({}, oldResult, function(err, newResult){
				if(!err && newResult){
					var total_pis		= newResult.app.nota_fiscal.pis ? helper.float2moeda((helper.moeda2float(newResult.app.nota_fiscal.pis)*helper.moeda2float(valor))/100) : '0,00',
						total_cofins	= newResult.app.nota_fiscal.cofins ? helper.float2moeda((helper.moeda2float(newResult.app.nota_fiscal.cofins)*helper.moeda2float(valor))/100) : '0,00',
						total_iss		= newResult.app.nota_fiscal.iss ? helper.float2moeda((helper.moeda2float(newResult.app.nota_fiscal.iss)*helper.moeda2float(valor))/100) : '0,00';

						return callback({
								rps: newResult.app.nota_fiscal.numero,
								total_pis: total_pis,
								total_cofins: total_cofins,
								total_iss: total_iss,
								total_impostos: helper.float2moeda(helper.moeda2float(total_iss) + helper.moeda2float(total_iss) + helper.moeda2float(total_iss)),
								cpf_cnpj: dadosClienteFormulario.cpf_cnpj ? helper.removerCaracteresEspeciais(dadosClienteFormulario.cpf_cnpj) : '',
								email: dadosClienteFormulario.email ? dadosClienteFormulario.email : '',
								ambiente: newResult.app.nota_fiscal.ambiente,
								status: 'Aguardando envio',
								data_emissao: new Date()
							});
				}
			});
		}else{
			console.log('Deu ruim 0_0\'/ ');
		}

	});
	
};

Controller.read = function() {
	var self	= this;
	return function(req, res, next) {
	var	options	= req.options;
		req.query.data_inicio = req.query.data_inicio || moment().format('DD/MM/YYYY');
		req.query.data_fim = req.query.data_fim || moment().format('DD/MM/YYYY');

		options.query = req.query;
		

		var filterPagamento = {
			'nota_fiscal.data_emissao': {
				'$gte': moment(options.query.data_inicio + ' 00:00', 'DD/MM/YYYY HH:mm').toISOString(),
				'$lte': moment(options.query.data_fim + ' 23:59', 'DD/MM/YYYY HH:mm').toISOString()
			},
			'excluido.data': null,
			'nota_fiscal.status': {$ne: null, $exists: true}
		};

		if(options.query.status)
			filterPagamento['nota_fiscal.status'] = options.query.status;
		
		if(options.query.rps)
			filterPagamento['nota_fiscal.rps'] = options.query.rps;

		console.log(filterPagamento);
		var page = req.query.page || 1;
		Pagamento.paginate(filterPagamento, {page: page, limit: 25, sort: {$natural: -1}}, function(err, result) {
			if(!err && result) {
				req.options.result = result.docs;
				
				req.options.total = Number(result.total);
				req.options.limit = Number(result.limit);
				req.options.page = Number(result.page);
				req.options.pages = Number(result.pages);

				req.options.pagination = helper.pagination(req.options);
			}
			res.render(self.route, req.options);
		});
	};
}

Controller.startNotaFiscalServer = function(){
	Configuracao.findOne({}, function(err, configuracao){
		if(!err && configuracao && configuracao.app.nota_fiscal && configuracao.app.nota_fiscal.ativo){
			//A cada 15 minutos os pagamentos com nota fiscal com status aguardando envio que não foram excluídos são repassados à tecnospeed
			Controller.startNotes();
			//A cada 30 minutos os pagamentos com nota fiscal com status aguardando envio, observação preenchidos que não foram excluídos são consultados na tecnospeed
			Controller.seeStatus();
		}
	});
}
// expose this inherited controller
module.exports = Controller;
