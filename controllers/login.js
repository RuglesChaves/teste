'use strict';
// encriptar a senha

var config 		 = require('../config'),
	Usuario		 = require('../models/usuario'),
	Configuracao = require('../models/configuracao'),
	helper 		 = require('../config/helper');
var nodemailer = require('nodemailer');
			
module.exports.addRoutes = function(app) {

	app.get('/', function(req, res) {
		var options = config.app();

		options.route = 'login';
		options.layout = 'login';
		options.title = 'Login';
		options.flash = req.flash();

		if(req.session.login) {
			res.redirect('/inicio');
		} else {
			if(req.cookies.login === undefined || req.cookies.senha === undefined) {
				res.render('login/index', options);
			} else {
				Usuario.findOne({login: req.cookies.login, senha: req.cookies.senha}).populate('_nivel_acesso').exec(function (err, usuario) {
					if(usuario !== null){
					    req.session.login = usuario;

					    if(req.session.redirect) {
					    	res.redirect(req.session.redirect);
					    	req.session.redirect = false;
					    } else
							res.redirect('/inicio');
					} else {
						res.render('login/index', options);
					}
				});
			}
		}
    });

	app.post('/', function(req, res) {
		Usuario.findOne({login: req.body.login, senha: req.body.senha}).populate('_nivel_acesso').exec(function (err, usuario) {
			if(err || !usuario) {
				res.json({err: 1, message: 'Verifique se os seus dados estão corretos.', focus: true});
			} else {
				// verifica se é um acesso externo, se for verifica se o usuario pode acessar externamente
				if(req.headers.host.indexOf('dyndns') !== -1 && usuario.acesso_externo !== true) {
					res.json({err: 1, message: 'Usuário não autorizado a acessar externamente.', clear: true});
				} else {
				    req.session.login = usuario; // salva o usuario na sessao
				    req.flash('success', helper.saudacao()+' '+usuario.nome+', seja bem-vindo(a) ao BRA Parking.');

					if(req.body.permanecer_conectado === 'true') {
						res.cookie('login', usuario.login, { maxAge: 900000 });
						res.cookie('senha', usuario.senha, { maxAge: 900000 });
					}

					if(req.session.redirect) {
				    	res.json({err: 0, redirect: req.session.redirect});
				    	req.session.redirect = false;
				    } else {
				    	res.json({err: 0, redirect: '/inicio'});
				    }
				}
			}
		});
	});

	app.post('/password-recovery', function(req, res) {
		Usuario.findOne({email: req.body.email}, function(err, result) {
			if(result === null) {
				res.json({err: 1, message: 'Verifique se o e-mail está correto.', focus: true});
			} else {
				Configuracao.findOne({}, function(err, configuracao) {
					if(err || !configuracao || !configuracao.app.email) {
						res.json({err: 1, message: 'O envio de e-mail ainda não foi configurado.', clear: true});
					} else {
						var fs = require('fs');

						fs.readFile('./views/layouts/email.html', 'utf8', function(error, html) {
							if(error || !html) {
								res.json({err: 1, message: 'Falha ao carregar template de email.', clear: true});	
							} else {
								var conteudo = '';
								conteudo += 'Recebemos uma solicitação para recuperação da senha associada a sua conta. Se você não fez essa solicitação, por favor, contate a administração.<br /><br /><br />';
								conteudo += 'Usuário: '+result.login+'<br />';
								conteudo += '<strong>Senha: '+result.senha+'</strong><br /><br /><br />';
								conteudo += 'Por motivos de segurança, aconselhamos que você altere sua senha em seu primeiro acesso.';
								var assunto = 'Recuperação de senha';

							    html = html.replace('{{ASSUNTO}}', assunto.toUpperCase());
							    html = html.replace('{{RAZAO_SOCIAL}}', configuracao.empresa.razao_social);
							    html = html.replace('{{CNPJ}}', configuracao.empresa.cnpj);
							    html = html.replace('{{ENDERECO}}', configuracao.empresa.endereco);
							    html = html.replace('{{NUMERO}}', configuracao.empresa.numero);
							    html = html.replace('{{TELEFONE1}}', configuracao.empresa.telefone1);
							    html = html.replace('{{TELEFONE2}}', configuracao.empresa.telefone2);
							    html = html.replace('{{BAIRRO}}', configuracao.empresa.bairro);
							    html = html.replace('{{ESTADO}}', configuracao.empresa.estado);
							    html = html.replace('{{CIDADE}}', configuracao.empresa.cidade);
							    html = html.replace('{{USUARIO}}', result.nome.toUpperCase());
							    html = html.replace('{{CONTEUDO}}', conteudo);

								var transporter = nodemailer.createTransport({
								   host: configuracao.app.email.servidor,
								   port: configuracao.app.email.porta,
								   secure: true,
								   auth: {
								        user: configuracao.app.email.email,
							    	    pass: configuracao.app.email.senha
								   }
								});

								var mailOptions = {
								    from: 'BRA Parking <'+configuracao.app.email.email+'>',
								    to: result.email,
								    subject: 'BRA Parking - '+assunto,
								    html: html
								}

								transporter.sendMail(mailOptions, function(err, info){
								    if(err) {
								        console.log(err);
								        res.json({err: 0, message: 'Ocorreu um erro ao enviar o e-mail.', clear: true});
								    }else{
								        res.json({err: 0, message: 'Sua senha foi enviada por e-mail.', clear: true, focus: true});
								    }
								});
						    }
						});
					}
				});
			}
		});
	});

	app.get('/logout', function(req, res) {
		res.clearCookie('login');
		res.clearCookie('senha');

		req.session.destroy(function(e) {
			res.redirect('/');
		});
	});

};
