CREATE TABLE `Actividades` (
  `idActividades` int(11) NOT NULL AUTO_INCREMENT,
  `Descripcion` varchar(100) NOT NULL,
  `tipocuota` int(11) DEFAULT NULL,
  `Valor` int(11) DEFAULT NULL,
  PRIMARY KEY (`idActividades`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `CategoriasSocios` (
  `idCategorias` int(11) NOT NULL AUTO_INCREMENT,
  `Descripcion` varchar(45) DEFAULT NULL,
  `GeneraCuotas` tinyint(1) DEFAULT NULL,
  `Monto` int(11) DEFAULT NULL,
  `EnviaMail` tinyint(1) DEFAULT NULL,
  `SocioActivo` int(1) DEFAULT NULL,
  `Edad_Minima` int(11) DEFAULT NULL,
  `Edad_Maxima` int(11) DEFAULT NULL,
  `Esquema` tinyint(1) NOT NULL DEFAULT 1,
  `MaximosIntegrantes` tinyint(1) DEFAULT NULL,
  `CategoriaActiva` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`idCategorias`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Clientes` (
  `idClientes` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(45) NOT NULL,
  `DNI` int(11) NOT NULL,
  `Fuerza` tinyint(1) NOT NULL DEFAULT 0,
  `Observaciones` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`idClientes`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Cobranza` (
  `idCobranza` int(11) NOT NULL AUTO_INCREMENT,
  `Descripcion` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`idCobranza`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Configuracion` (
  `idConfiguracion` int(11) NOT NULL,
  `Entidad` varchar(70) NOT NULL,
  `CuotasMoroso` int(11) NOT NULL DEFAULT 0,
  `CobroCuota` int(11) NOT NULL,
  `mail_smtp_server` varchar(100) DEFAULT NULL,
  `mail_smtp_user` varchar(100) DEFAULT NULL,
  `mail_smtp_pass` varchar(100) DEFAULT NULL,
  `mail_from` varchar(100) DEFAULT NULL,
  `mail_subject` varchar(100) DEFAULT NULL,
  `mail_port` varchar(100) DEFAULT NULL,
  `mail_tp_connection` varchar(100) DEFAULT NULL,
  `mail_body` mediumtext DEFAULT NULL,
  `StockNegativo` tinyint(4) NOT NULL,
  `VentaDefault` int(11) NOT NULL,
  `URL` varchar(50) DEFAULT NULL,
  `MP_BaseURL` varchar(255) DEFAULT NULL,
  `MP_AccessToken` varchar(255) DEFAULT NULL,
  `MP_PublicKey` varchar(255) DEFAULT NULL,
  `Logo` longblob DEFAULT NULL,
  `Logo_N` varchar(50) DEFAULT NULL,
  `Logo_T` int(11) DEFAULT NULL,
  `idEmpresa` int(11) NOT NULL,
  `Mail` varchar(100) DEFAULT NULL,
  `Telefono` varchar(45) DEFAULT NULL,
  `Web` varchar(100) DEFAULT NULL,
  `Facebook` varchar(100) DEFAULT NULL,
  `Instagram` varchar(100) DEFAULT NULL,
  `X` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`idConfiguracion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Cuotas` (
  `idCuotas` int(11) NOT NULL AUTO_INCREMENT,
  `Socios_NroSocio` int(11) NOT NULL,
  `MesCuota` int(11) NOT NULL,
  `AnoCuota` int(11) NOT NULL,
  `tipo` int(11) NOT NULL DEFAULT 0,
  `FechaPago` date DEFAULT NULL,
  `Monto` decimal(10,2) NOT NULL,
  `Nota` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`idCuotas`),
  UNIQUE KEY `Cuota_unica` (`Socios_NroSocio`,`MesCuota`,`AnoCuota`,`tipo`) USING BTREE,
  KEY `tipo` (`tipo`),
  KEY `Socios_NroSocio` (`Socios_NroSocio`),
  CONSTRAINT `Cuotas_ibfk_1` FOREIGN KEY (`tipo`) REFERENCES `TipoCuota` (`idTipoCuota`),
  CONSTRAINT `Cuotas_ibfk_2` FOREIGN KEY (`Socios_NroSocio`) REFERENCES `Socios` (`NroSocio`)
) ENGINE=InnoDB AUTO_INCREMENT=144823 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Deposito` (
  `idDeposito` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`idDeposito`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Elementos` (
  `idElementos` int(11) NOT NULL AUTO_INCREMENT,
  `NombreElemento` varchar(45) DEFAULT NULL,
  `TiempoTurno` int(11) DEFAULT NULL,
  `HoraInicio` time NOT NULL,
  `HoraFin` time NOT NULL,
  PRIMARY KEY (`idElementos`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `GruposFamiliares` (
  `Socios_idSocios` int(11) NOT NULL,
  `Estado` tinyint(1) NOT NULL,
  `SocioTitular` int(11) DEFAULT NULL,
  `Parentescos_idParentesco` int(11) DEFAULT NULL,
  `Categorias_idCategorias` int(11) DEFAULT NULL,
  PRIMARY KEY (`Socios_idSocios`) USING BTREE,
  KEY `Socios_idSocios` (`Socios_idSocios`),
  KEY `Parentescos_idParentesco` (`Parentescos_idParentesco`),
  KEY `Categorias_idCategorias` (`Categorias_idCategorias`),
  CONSTRAINT `GruposFamiliares_ibfk_1` FOREIGN KEY (`Socios_idSocios`) REFERENCES `Socios` (`NroSocio`),
  CONSTRAINT `GruposFamiliares_ibfk_2` FOREIGN KEY (`Parentescos_idParentesco`) REFERENCES `Parentescos` (`idParentesco`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Habilitados` (
  `Socio` int(11) NOT NULL,
  `Item` int(11) NOT NULL,
  PRIMARY KEY (`Socio`,`Item`),
  KEY `Item` (`Item`),
  KEY `Socio` (`Socio`),
  CONSTRAINT `Habilitados_ibfk_1` FOREIGN KEY (`Socio`) REFERENCES `Socios` (`NroSocio`),
  CONSTRAINT `Habilitados_ibfk_2` FOREIGN KEY (`Item`) REFERENCES `ItemsVentas` (`idItem`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `ItemsVentas` (
  `idItem` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `ValorSocio` int(11) NOT NULL,
  `ValorNoSocio` int(11) NOT NULL,
  `RequiereHabilitacion` tinyint(1) NOT NULL,
  `DescuentaStock` tinyint(1) NOT NULL DEFAULT 1,
  `Porcentaje` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`idItem`)
) ENGINE=InnoDB AUTO_INCREMENT=741 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `MontosCategoriasSocios` (
  `CategoriasSocios_idCategorias` int(11) NOT NULL,
  `InicioVigencia` date NOT NULL,
  `Monto` int(11) NOT NULL,
  PRIMARY KEY (`CategoriasSocios_idCategorias`,`InicioVigencia`),
  KEY `CategoriasSocios_idCategorias` (`CategoriasSocios_idCategorias`),
  CONSTRAINT `MontosCategoriasSocios_ibfk_1` FOREIGN KEY (`CategoriasSocios_idCategorias`) REFERENCES `CategoriasSocios` (`idCategorias`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `MovimientosStock` (
  `IdMovimientosStock` int(11) NOT NULL AUTO_INCREMENT,
  `Fecha` date NOT NULL,
  `ItemsVentas_idItem` int(11) NOT NULL,
  `Cantidad` int(11) NOT NULL,
  `Observaciones` text NOT NULL,
  `idDeposito_Origen` int(11) DEFAULT NULL,
  `idDeposito_Destino` int(11) DEFAULT 0,
  `costo` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`IdMovimientosStock`),
  KEY `ItemsVentas_idItem` (`ItemsVentas_idItem`),
  KEY `idDeposito_Origen` (`idDeposito_Origen`),
  KEY `idDeposito_Destino` (`idDeposito_Destino`),
  CONSTRAINT `MovimientosStock_ibfk_1` FOREIGN KEY (`idDeposito_Origen`) REFERENCES `Deposito` (`idDeposito`),
  CONSTRAINT `MovimientosStock_ibfk_3` FOREIGN KEY (`ItemsVentas_idItem`) REFERENCES `ItemsVentas` (`idItem`)
) ENGINE=InnoDB AUTO_INCREMENT=1857 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Parentescos` (
  `idParentesco` int(11) NOT NULL AUTO_INCREMENT,
  `Descripcion` varchar(20) NOT NULL,
  PRIMARY KEY (`idParentesco`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Provincias` (
  `idProvincias` int(11) NOT NULL AUTO_INCREMENT,
  `Descripcion` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`idProvincias`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Socios` (
  `NroSocio` int(11) NOT NULL AUTO_INCREMENT,
  `Apellido` varchar(45) NOT NULL,
  `Nombre` varchar(45) NOT NULL,
  `DNI` int(11) NOT NULL,
  `Sexo` varchar(1) NOT NULL,
  `Foto` longblob DEFAULT NULL,
  `Foto_N` varchar(50) NOT NULL,
  `Foto_T` int(11) NOT NULL,
  `FechaNacimiento` date DEFAULT NULL,
  `Direccion` varchar(45) NOT NULL,
  `Telefono` varchar(45) DEFAULT NULL,
  `Celular` varchar(45) DEFAULT NULL,
  `Mail1` varchar(45) DEFAULT NULL,
  `Mail2` varchar(45) DEFAULT NULL,
  `CLU` varchar(45) DEFAULT NULL,
  `Vto-CLU` date DEFAULT NULL,
  `FechaAlta` date DEFAULT NULL,
  `FechaBaja` date DEFAULT NULL,
  `Categorias_idCategorias` int(11) NOT NULL,
  `Provincias_idProvincias` int(11) NOT NULL,
  `localidad_idlocalidad` int(11) NOT NULL,
  `Ciudad` varchar(45) NOT NULL,
  `Cobranza_idCobranza` int(11) NOT NULL,
  `GrupoSangre` varchar(10) DEFAULT NULL,
  `Sanciones` varchar(1000) DEFAULT NULL,
  `OtrasNotas` varchar(1000) DEFAULT NULL,
  `Profesion` varchar(45) DEFAULT NULL,
  `CuentaBanco` varchar(45) DEFAULT NULL,
  `CBU` varchar(22) DEFAULT NULL,
  `CUIT` varchar(11) DEFAULT NULL,
  `AA_anos` int(11) NOT NULL DEFAULT 0,
  `AA_meses` int(11) NOT NULL DEFAULT 0,
  `AA_dias` int(11) NOT NULL DEFAULT 0,
  `Activo` varchar(1) NOT NULL DEFAULT 'Y',
  `password` varchar(50) DEFAULT NULL,
  `priv_admin` varchar(1) NOT NULL DEFAULT 'N',
  `mfa` varchar(255) DEFAULT NULL,
  `CodigoActivacion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`NroSocio`),
  UNIQUE KEY `DNI_unique` (`DNI`),
  KEY `Categorias_idCategorias` (`Categorias_idCategorias`),
  KEY `Cobranza_idCobranza` (`Cobranza_idCobranza`),
  KEY `localidad_idlocalidad` (`localidad_idlocalidad`),
  KEY `Provincias_idProvincias` (`Provincias_idProvincias`),
  CONSTRAINT `Socios_ibfk_1` FOREIGN KEY (`Categorias_idCategorias`) REFERENCES `CategoriasSocios` (`idCategorias`),
  CONSTRAINT `Socios_ibfk_2` FOREIGN KEY (`localidad_idlocalidad`) REFERENCES `localidad` (`idlocalidad`),
  CONSTRAINT `Socios_ibfk_3` FOREIGN KEY (`Provincias_idProvincias`) REFERENCES `Provincias` (`idProvincias`),
  CONSTRAINT `Socios_ibfk_4` FOREIGN KEY (`Cobranza_idCobranza`) REFERENCES `Cobranza` (`idCobranza`)
) ENGINE=InnoDB AUTO_INCREMENT=10479 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `SociosEnActividades` (
  `Actividades_idActividades` int(11) NOT NULL,
  `Socios_NroSocio` int(11) NOT NULL,
  PRIMARY KEY (`Actividades_idActividades`,`Socios_NroSocio`),
  KEY `fk_Actividades_has_Socios_Socios1_idx` (`Socios_NroSocio`),
  KEY `fk_Actividades_has_Socios_Actividades1_idx` (`Actividades_idActividades`),
  CONSTRAINT `fk_Actividades_has_Socios_Actividades1` FOREIGN KEY (`Actividades_idActividades`) REFERENCES `Actividades` (`idActividades`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_Actividades_has_Socios_Socios1` FOREIGN KEY (`Socios_NroSocio`) REFERENCES `Socios` (`NroSocio`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Stock` (
  `Deposito_idDeposito` int(11) NOT NULL,
  `ItemsVentas_idItem` int(11) NOT NULL,
  `Cantidad` int(11) DEFAULT NULL,
  PRIMARY KEY (`Deposito_idDeposito`,`ItemsVentas_idItem`),
  KEY `Deposito_idDeposito` (`Deposito_idDeposito`),
  KEY `ItemsVentas_idItem` (`ItemsVentas_idItem`),
  CONSTRAINT `Stock_ibfk_1` FOREIGN KEY (`Deposito_idDeposito`) REFERENCES `Deposito` (`idDeposito`),
  CONSTRAINT `Stock_ibfk_2` FOREIGN KEY (`ItemsVentas_idItem`) REFERENCES `ItemsVentas` (`idItem`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `TipoCuota` (
  `idTipoCuota` int(11) NOT NULL AUTO_INCREMENT,
  `Descripcion` varchar(20) NOT NULL,
  PRIMARY KEY (`idTipoCuota`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Turnos` (
  `idTurnos` int(11) NOT NULL AUTO_INCREMENT,
  `Elementos_idElementos` int(11) NOT NULL,
  `Descripcion` varchar(50) DEFAULT NULL,
  `Dia` date NOT NULL,
  `HoraInicio` time NOT NULL,
  `HoraFin` time NOT NULL,
  `Socios_NroSocio` int(11) DEFAULT NULL,
  `Clientes_idClientes` int(11) DEFAULT NULL,
  PRIMARY KEY (`idTurnos`),
  KEY `Elementos_idElementos` (`Elementos_idElementos`),
  KEY `Socios_NroSocio` (`Socios_NroSocio`),
  KEY `Clientes_idClientes` (`Clientes_idClientes`),
  CONSTRAINT `Turnos_ibfk_1` FOREIGN KEY (`Elementos_idElementos`) REFERENCES `Elementos` (`idElementos`),
  CONSTRAINT `Turnos_ibfk_2` FOREIGN KEY (`Socios_NroSocio`) REFERENCES `Socios` (`NroSocio`),
  CONSTRAINT `Turnos_ibfk_3` FOREIGN KEY (`Clientes_idClientes`) REFERENCES `Clientes` (`idClientes`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `VentasCabecera` (
  `idVentasCabecera` int(11) NOT NULL AUTO_INCREMENT,
  `Fecha` date NOT NULL,
  `Total` int(11) NOT NULL,
  `Socios_NroSocio` int(11) DEFAULT NULL,
  `Clientes_idClientes` int(11) DEFAULT NULL,
  PRIMARY KEY (`idVentasCabecera`)
) ENGINE=InnoDB AUTO_INCREMENT=14776 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `VentasDetalles` (
  `idVentasDetalles` int(11) NOT NULL AUTO_INCREMENT,
  `VentasCabecera_idVentasCabecera` int(11) NOT NULL,
  `ItemsVentas_idItem` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `Monto_Unidad` int(11) NOT NULL,
  `Monto_Total` int(11) NOT NULL,
  PRIMARY KEY (`idVentasDetalles`),
  KEY `VentasDetalles_ibfk_1` (`VentasCabecera_idVentasCabecera`),
  KEY `VentasDetalles_ibfk_2` (`ItemsVentas_idItem`),
  CONSTRAINT `VentasDetalles_ibfk_1` FOREIGN KEY (`VentasCabecera_idVentasCabecera`) REFERENCES `VentasCabecera` (`idVentasCabecera`),
  CONSTRAINT `VentasDetalles_ibfk_2` FOREIGN KEY (`ItemsVentas_idItem`) REFERENCES `ItemsVentas` (`idItem`)
) ENGINE=InnoDB AUTO_INCREMENT=25294 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `cajas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(40) DEFAULT NULL,
  `saldo` decimal(15,2) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=COMPACT;

CREATE TABLE `categorias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` char(1) DEFAULT NULL,
  `nombre` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=193 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=COMPACT;

CREATE TABLE `localidad` (
  `idlocalidad` int(11) NOT NULL AUTO_INCREMENT,
  `nombredepartamento` varchar(100) NOT NULL,
  `provincia_idprovincia` int(11) NOT NULL,
  `latitude` varchar(100) NOT NULL,
  `longitude` varchar(100) NOT NULL,
  PRIMARY KEY (`idlocalidad`),
  KEY `provincia_idprovincia` (`provincia_idprovincia`),
  CONSTRAINT `localidad_ibfk_1` FOREIGN KEY (`provincia_idprovincia`) REFERENCES `Provincias` (`idProvincias`)
) ENGINE=InnoDB AUTO_INCREMENT=576 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `meses` (
  `idmes` int(11) NOT NULL AUTO_INCREMENT,
  `Descripcion` varchar(20) NOT NULL,
  PRIMARY KEY (`idmes`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `movimientos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `caja_id` int(11) NOT NULL,
  `categoria_id` int(11) DEFAULT NULL,
  `fecha` date NOT NULL,
  `detalle` varchar(200) DEFAULT NULL,
  `importe` decimal(15,2) DEFAULT NULL,
  `link` varchar(150) DEFAULT NULL,
  `conciliado` tinyint(1) DEFAULT NULL,
  `tipo` char(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `caja_id` (`caja_id`),
  KEY `categoria_id` (`categoria_id`),
  CONSTRAINT `movimientos_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`),
  CONSTRAINT `movimientos_ibfk_2` FOREIGN KEY (`caja_id`) REFERENCES `cajas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=53224 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=COMPACT;

CREATE TABLE `sc_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inserted_date` datetime DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `application` varchar(200) NOT NULL,
  `creator` varchar(30) NOT NULL,
  `ip_user` varchar(32) NOT NULL,
  `action` varchar(30) NOT NULL,
  `description` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=183060 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `sec_apps` (
  `app_name` varchar(128) NOT NULL,
  `app_type` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`app_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `sec_groups` (
  `group_id` int(11) NOT NULL AUTO_INCREMENT,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`group_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

CREATE TABLE `sec_groups_apps` (
  `group_id` int(11) NOT NULL,
  `app_name` varchar(128) NOT NULL,
  `priv_access` varchar(1) DEFAULT NULL,
  `priv_insert` varchar(1) DEFAULT NULL,
  `priv_delete` varchar(1) DEFAULT NULL,
  `priv_update` varchar(1) DEFAULT NULL,
  `priv_export` varchar(1) DEFAULT NULL,
  `priv_print` varchar(1) DEFAULT NULL,
  PRIMARY KEY (`group_id`,`app_name`),
  KEY `group_id` (`group_id`),
  KEY `app_name` (`app_name`),
  CONSTRAINT `sec_groups_apps_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `sec_groups` (`group_id`),
  CONSTRAINT `sec_groups_apps_ibfk_2` FOREIGN KEY (`app_name`) REFERENCES `sec_apps` (`app_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `sec_settings` (
  `set_name` varchar(255) NOT NULL,
  `set_value` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`set_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `sec_users` (
  `login` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `pswd` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `name` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `email` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `active` varchar(1) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `activation_code` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `priv_admin` varchar(1) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT 'N',
  `Caja_default` int(11) NOT NULL,
  `Deposito_default` int(11) NOT NULL,
  PRIMARY KEY (`login`),
  KEY `Caja_default` (`Caja_default`),
  KEY `Deposito_default` (`Deposito_default`),
  CONSTRAINT `sec_users_ibfk_1` FOREIGN KEY (`Caja_default`) REFERENCES `cajas` (`id`),
  CONSTRAINT `sec_users_ibfk_2` FOREIGN KEY (`Deposito_default`) REFERENCES `Deposito` (`idDeposito`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `sec_users_groups` (
  `login` varchar(255) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`login`,`group_id`),
  KEY `login` (`login`),
  KEY `group_id` (`group_id`),
  CONSTRAINT `sec_users_groups_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `sec_groups` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `sec_users_social` (
  `login` varchar(190) NOT NULL,
  `resource` varchar(190) NOT NULL,
  `resource_id` varchar(190) NOT NULL,
  PRIMARY KEY (`login`),
  KEY `login` (`login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

