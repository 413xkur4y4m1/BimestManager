-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: labs
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `adeudos`
--

DROP TABLE IF EXISTS `adeudos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `adeudos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `material_id` int NOT NULL,
  `incidencia_id` int DEFAULT NULL,
  `estado` enum('PENDIENTE','RESUELTO') DEFAULT 'PENDIENTE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `material_id` (`material_id`),
  KEY `incidencia_id` (`incidencia_id`),
  CONSTRAINT `adeudos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `adeudos_ibfk_2` FOREIGN KEY (`material_id`) REFERENCES `materiales` (`id`),
  CONSTRAINT `adeudos_ibfk_3` FOREIGN KEY (`incidencia_id`) REFERENCES `incidencias` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `adeudos`
--

LOCK TABLES `adeudos` WRITE;
/*!40000 ALTER TABLE `adeudos` DISABLE KEYS */;
/*!40000 ALTER TABLE `adeudos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `equipo_integrantes`
--

DROP TABLE IF EXISTS `equipo_integrantes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `equipo_integrantes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `equipo_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `equipo_id` (`equipo_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `equipo_integrantes_ibfk_1` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `equipo_integrantes_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `equipo_integrantes`
--

LOCK TABLES `equipo_integrantes` WRITE;
/*!40000 ALTER TABLE `equipo_integrantes` DISABLE KEYS */;
/*!40000 ALTER TABLE `equipo_integrantes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `equipos`
--

DROP TABLE IF EXISTS `equipos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `equipos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sesion_id` int NOT NULL,
  `nombre` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sesion_id` (`sesion_id`),
  CONSTRAINT `equipos_ibfk_1` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `equipos`
--

LOCK TABLES `equipos` WRITE;
/*!40000 ALTER TABLE `equipos` DISABLE KEYS */;
/*!40000 ALTER TABLE `equipos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grupos`
--

DROP TABLE IF EXISTS `grupos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grupos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grupos`
--

LOCK TABLES `grupos` WRITE;
/*!40000 ALTER TABLE `grupos` DISABLE KEYS */;
/*!40000 ALTER TABLE `grupos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incidencias`
--

DROP TABLE IF EXISTS `incidencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incidencias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sesion_id` int NOT NULL,
  `equipo_id` int NOT NULL,
  `material_id` int NOT NULL,
  `tipo` enum('ROTO','PERDIDO') NOT NULL,
  `descripcion` text,
  `responsable_usuario_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sesion_id` (`sesion_id`),
  KEY `equipo_id` (`equipo_id`),
  KEY `material_id` (`material_id`),
  KEY `responsable_usuario_id` (`responsable_usuario_id`),
  CONSTRAINT `incidencias_ibfk_1` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`),
  CONSTRAINT `incidencias_ibfk_2` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `incidencias_ibfk_3` FOREIGN KEY (`material_id`) REFERENCES `materiales` (`id`),
  CONSTRAINT `incidencias_ibfk_4` FOREIGN KEY (`responsable_usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incidencias`
--

LOCK TABLES `incidencias` WRITE;
/*!40000 ALTER TABLE `incidencias` DISABLE KEYS */;
/*!40000 ALTER TABLE `incidencias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incidencias_turismo`
--

DROP TABLE IF EXISTS `incidencias_turismo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incidencias_turismo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prestamo_id` int NOT NULL,
  `descripcion` text,
  `tipo` enum('ROTO','PERDIDO') NOT NULL,
  `estado` enum('PENDIENTE','RESUELTO') DEFAULT 'PENDIENTE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `prestamo_id` (`prestamo_id`),
  CONSTRAINT `incidencias_turismo_ibfk_1` FOREIGN KEY (`prestamo_id`) REFERENCES `prestamos_material_turismo` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incidencias_turismo`
--

LOCK TABLES `incidencias_turismo` WRITE;
/*!40000 ALTER TABLE `incidencias_turismo` DISABLE KEYS */;
/*!40000 ALTER TABLE `incidencias_turismo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kit_materiales`
--

DROP TABLE IF EXISTS `kit_materiales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kit_materiales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kit_id` int NOT NULL,
  `material_id` int NOT NULL,
  `cantidad` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `kit_id` (`kit_id`),
  KEY `material_id` (`material_id`),
  CONSTRAINT `kit_materiales_ibfk_1` FOREIGN KEY (`kit_id`) REFERENCES `kits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kit_materiales_ibfk_2` FOREIGN KEY (`material_id`) REFERENCES `materiales` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kit_materiales`
--

LOCK TABLES `kit_materiales` WRITE;
/*!40000 ALTER TABLE `kit_materiales` DISABLE KEYS */;
/*!40000 ALTER TABLE `kit_materiales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kits`
--

DROP TABLE IF EXISTS `kits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `practica_id` int NOT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `practica_id` (`practica_id`),
  CONSTRAINT `kits_ibfk_1` FOREIGN KEY (`practica_id`) REFERENCES `practicas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kits`
--

LOCK TABLES `kits` WRITE;
/*!40000 ALTER TABLE `kits` DISABLE KEYS */;
/*!40000 ALTER TABLE `kits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `materiales`
--

DROP TABLE IF EXISTS `materiales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `materiales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `stock` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `materiales`
--

LOCK TABLES `materiales` WRITE;
/*!40000 ALTER TABLE `materiales` DISABLE KEYS */;
/*!40000 ALTER TABLE `materiales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `materiales_turismo`
--

DROP TABLE IF EXISTS `materiales_turismo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `materiales_turismo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `estado` enum('DISPONIBLE','DAÑADO') DEFAULT 'DISPONIBLE',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `materiales_turismo`
--

LOCK TABLES `materiales_turismo` WRITE;
/*!40000 ALTER TABLE `materiales_turismo` DISABLE KEYS */;
/*!40000 ALTER TABLE `materiales_turismo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificaciones`
--

DROP TABLE IF EXISTS `notificaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `mensaje` text NOT NULL,
  `leido` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `notificaciones_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificaciones`
--

LOCK TABLES `notificaciones` WRITE;
/*!40000 ALTER TABLE `notificaciones` DISABLE KEYS */;
/*!40000 ALTER TABLE `notificaciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificaciones_turismo`
--

DROP TABLE IF EXISTS `notificaciones_turismo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificaciones_turismo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `mensaje` text NOT NULL,
  `leido` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `notificaciones_turismo_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios_turismo` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificaciones_turismo`
--

LOCK TABLES `notificaciones_turismo` WRITE;
/*!40000 ALTER TABLE `notificaciones_turismo` DISABLE KEYS */;
/*!40000 ALTER TABLE `notificaciones_turismo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `practicas`
--

DROP TABLE IF EXISTS `practicas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `practicas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo` enum('QUIMICA','TURISMO') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `practicas`
--

LOCK TABLES `practicas` WRITE;
/*!40000 ALTER TABLE `practicas` DISABLE KEYS */;
/*!40000 ALTER TABLE `practicas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `practicas_turismo`
--

DROP TABLE IF EXISTS `practicas_turismo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `practicas_turismo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text,
  `duracion_minutos` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `practicas_turismo`
--

LOCK TABLES `practicas_turismo` WRITE;
/*!40000 ALTER TABLE `practicas_turismo` DISABLE KEYS */;
/*!40000 ALTER TABLE `practicas_turismo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prestamos`
--

DROP TABLE IF EXISTS `prestamos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prestamos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `material_id` int NOT NULL,
  `cantidad` int NOT NULL,
  `fecha_prestamo` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_devolucion` timestamp NULL DEFAULT NULL,
  `estado` enum('ACTIVO','DEVUELTO') DEFAULT 'ACTIVO',
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `material_id` (`material_id`),
  CONSTRAINT `prestamos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `prestamos_ibfk_2` FOREIGN KEY (`material_id`) REFERENCES `materiales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prestamos`
--

LOCK TABLES `prestamos` WRITE;
/*!40000 ALTER TABLE `prestamos` DISABLE KEYS */;
/*!40000 ALTER TABLE `prestamos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prestamos_material_turismo`
--

DROP TABLE IF EXISTS `prestamos_material_turismo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prestamos_material_turismo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sesion_id` int NOT NULL,
  `alumno_id` int NOT NULL,
  `material_id` int NOT NULL,
  `cantidad` int NOT NULL,
  `estado` enum('PRESTADO','DEVUELTO','PENDIENTE','ADEUDO') DEFAULT 'PRESTADO',
  `fecha_prestamo` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_devolucion` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sesion_id` (`sesion_id`),
  KEY `alumno_id` (`alumno_id`),
  KEY `material_id` (`material_id`),
  CONSTRAINT `prestamos_material_turismo_ibfk_1` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones_turismo` (`id`),
  CONSTRAINT `prestamos_material_turismo_ibfk_2` FOREIGN KEY (`alumno_id`) REFERENCES `usuarios_turismo` (`id`),
  CONSTRAINT `prestamos_material_turismo_ibfk_3` FOREIGN KEY (`material_id`) REFERENCES `materiales_turismo` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prestamos_material_turismo`
--

LOCK TABLES `prestamos_material_turismo` WRITE;
/*!40000 ALTER TABLE `prestamos_material_turismo` DISABLE KEYS */;
/*!40000 ALTER TABLE `prestamos_material_turismo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `responsivas`
--

DROP TABLE IF EXISTS `responsivas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `responsivas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sesion_id` int NOT NULL,
  `equipo_id` int NOT NULL,
  `estado` enum('ACTIVA','FINALIZADA') DEFAULT 'ACTIVA',
  PRIMARY KEY (`id`),
  KEY `sesion_id` (`sesion_id`),
  KEY `equipo_id` (`equipo_id`),
  CONSTRAINT `responsivas_ibfk_1` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`),
  CONSTRAINT `responsivas_ibfk_2` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `responsivas`
--

LOCK TABLES `responsivas` WRITE;
/*!40000 ALTER TABLE `responsivas` DISABLE KEYS */;
/*!40000 ALTER TABLE `responsivas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sesiones`
--

DROP TABLE IF EXISTS `sesiones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesiones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `practica_id` int NOT NULL,
  `maestro_id` int NOT NULL,
  `grupo_id` int NOT NULL,
  `fecha` date NOT NULL,
  `hora_inicio` time DEFAULT NULL,
  `duracion_min` int DEFAULT NULL,
  `num_equipos` int DEFAULT NULL,
  `integrantes_por_equipo` int DEFAULT NULL,
  `estado` enum('PROGRAMADA','EN_CURSO','FINALIZADA') DEFAULT 'PROGRAMADA',
  PRIMARY KEY (`id`),
  KEY `practica_id` (`practica_id`),
  KEY `maestro_id` (`maestro_id`),
  KEY `grupo_id` (`grupo_id`),
  CONSTRAINT `sesiones_ibfk_1` FOREIGN KEY (`practica_id`) REFERENCES `practicas` (`id`),
  CONSTRAINT `sesiones_ibfk_2` FOREIGN KEY (`maestro_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `sesiones_ibfk_3` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sesiones`
--

LOCK TABLES `sesiones` WRITE;
/*!40000 ALTER TABLE `sesiones` DISABLE KEYS */;
/*!40000 ALTER TABLE `sesiones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sesiones_turismo`
--

DROP TABLE IF EXISTS `sesiones_turismo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesiones_turismo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `practica_id` int NOT NULL,
  `grupo` varchar(50) NOT NULL,
  `fecha_inicio` datetime NOT NULL,
  `fecha_fin` datetime NOT NULL,
  `estado` enum('PROGRAMADA','EN_CURSO','FINALIZADA') DEFAULT 'PROGRAMADA',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `practica_id` (`practica_id`),
  CONSTRAINT `sesiones_turismo_ibfk_1` FOREIGN KEY (`practica_id`) REFERENCES `practicas_turismo` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sesiones_turismo`
--

LOCK TABLES `sesiones_turismo` WRITE;
/*!40000 ALTER TABLE `sesiones_turismo` DISABLE KEYS */;
/*!40000 ALTER TABLE `sesiones_turismo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sugerencias_material_turismo`
--

DROP TABLE IF EXISTS `sugerencias_material_turismo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sugerencias_material_turismo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `practica_id` int NOT NULL,
  `material_id` int NOT NULL,
  `cantidad_sugerida` int DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `practica_id` (`practica_id`),
  KEY `material_id` (`material_id`),
  CONSTRAINT `sugerencias_material_turismo_ibfk_1` FOREIGN KEY (`practica_id`) REFERENCES `practicas_turismo` (`id`),
  CONSTRAINT `sugerencias_material_turismo_ibfk_2` FOREIGN KEY (`material_id`) REFERENCES `materiales_turismo` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sugerencias_material_turismo`
--

LOCK TABLES `sugerencias_material_turismo` WRITE;
/*!40000 ALTER TABLE `sugerencias_material_turismo` DISABLE KEYS */;
/*!40000 ALTER TABLE `sugerencias_material_turismo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` enum('ADMIN','MAESTRO','ALUMNO') NOT NULL,
  `grupo_id` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_usuario_grupo` (`grupo_id`),
  CONSTRAINT `fk_usuario_grupo` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios_turismo`
--

DROP TABLE IF EXISTS `usuarios_turismo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios_turismo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` enum('ADMIN','ALUMNO') NOT NULL,
  `grupo` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios_turismo`
--

LOCK TABLES `usuarios_turismo` WRITE;
/*!40000 ALTER TABLE `usuarios_turismo` DISABLE KEYS */;
/*!40000 ALTER TABLE `usuarios_turismo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'labs'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-08 21:45:17
