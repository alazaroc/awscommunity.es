import type { SourceDefinition, UserGroup } from '../src/lib/types';

const meetupSources = (slug: string): SourceDefinition[] => [
  { type: 'meetup-rss', url: `https://www.meetup.com/${slug}/events/rss/`, enabled: true, allowAutomatedFetch: true },
];

export const userGroups: UserGroup[] = [
  {
    id: 'asturias', name: 'AWS User Group Asturias', city: 'Asturias', region: 'Principado de Asturias',
    description: 'Grupo abierto a cualquier persona interesada en Amazon Web Services. Su objetivo es construir comunidad alrededor de AWS mediante encuentros sociales y charlas sobre innovación, desarrollo y experiencias, donde compartir problemas y soluciones técnicas.',
    website: 'https://www.meetup.com/es-ES/aws-user-group-asturias/', meetupUrl: 'https://www.meetup.com/es-ES/aws-user-group-asturias/',
    eventSources: meetupSources('aws-user-group-asturias'), active: true,
    coordinates: { latitude: 43.3614, longitude: -5.8494 },
  },
  {
    id: 'alicante', name: 'AWS User Group Alicante', city: 'Alicante', region: 'Comunitat Valenciana',
    description: 'Comunidad dedicada a transmitir conocimiento sobre los servicios de AWS en la zona de Levante. Comparte herramientas, buenas prácticas y experiencias para diseñar arquitecturas cloud y mostrar cómo aprovechar mejor la nube.',
    website: 'https://www.meetup.com/es-ES/aws-user-group-alicante/', meetupUrl: 'https://www.meetup.com/es-ES/aws-user-group-alicante/',
    eventSources: meetupSources('aws-user-group-alicante'), active: true,
    coordinates: { latitude: 38.3452, longitude: -0.481 },
  },
  {
    id: 'barcelona', name: 'AWS User Group Barcelona', city: 'Barcelona', region: 'Catalunya',
    description: 'Grupo local de usuarios de AWS en Barcelona. Es una comunidad independiente: sus actividades y las opiniones compartidas en ellas no representan a Amazon Web Services.',
    website: 'https://www.meetup.com/es-ES/barcelona-amazon-web-services-meetup/', meetupUrl: 'https://www.meetup.com/es-ES/barcelona-amazon-web-services-meetup/',
    eventSources: meetupSources('barcelona-amazon-web-services-meetup'), active: true,
    coordinates: { latitude: 41.3874, longitude: 2.1686 },
  },
  {
    id: 'bilbao', name: 'AWS User Group Bilbao', city: 'Bilbao', region: 'Euskadi',
    description: 'Comunidad para empresas y personas que quieren empezar con AWS o ya lo utilizan. Busca fomentar, compartir y usar AWS en Bilbao con ayuda y recursos en castellano, conectando a profesionales de la tecnología de la zona.',
    website: 'https://www.meetup.com/es-ES/aws-bilbao/', meetupUrl: 'https://www.meetup.com/es-ES/aws-bilbao/',
    eventSources: meetupSources('aws-bilbao'), active: true,
    coordinates: { latitude: 43.263, longitude: -2.935 },
  },
  {
    id: 'galicia', name: 'AWS User Group Galicia', city: 'Galicia', region: 'Galicia',
    description: 'Comunidad abierta de profesionales, estudiantes y entusiastas del cloud en Galicia. Organiza charlas, talleres y eventos para intercambiar conocimiento, experiencias y buenas prácticas sobre arquitectura, IA/ML, DevOps, seguridad, serverless y otros ámbitos de AWS.',
    website: 'https://www.meetup.com/es-ES/aws-ug-galicia/', meetupUrl: 'https://www.meetup.com/es-ES/aws-ug-galicia/',
    eventSources: meetupSources('aws-ug-galicia'), active: true,
    coordinates: { latitude: 42.8782, longitude: -8.5448 },
  },
  {
    id: 'las-palmas', name: 'AWS User Group Las Palmas', city: 'Las Palmas', region: 'Canarias', timezone: 'Atlantic/Canary',
    description: 'Comunidad de entusiastas del cloud, profesionales de tecnología y consultores de AWS en Las Palmas de Gran Canaria. Ofrece presentaciones, networking y talleres prácticos para compartir conocimiento, colaborar y aprender, con actividades abiertas a todos los niveles.',
    website: 'https://www.meetup.com/es-ES/aws-las-palmas-user-group/', meetupUrl: 'https://www.meetup.com/es-ES/aws-las-palmas-user-group/',
    eventSources: meetupSources('aws-las-palmas-user-group'), active: true,
    coordinates: { latitude: 28.1235, longitude: -15.4363 },
  },
  {
    id: 'madrid', name: 'AWS User Group Madrid', city: 'Madrid', region: 'Comunidad de Madrid',
    description: 'Grupo para usuarios, personas apasionadas por las nuevas tecnologías y clientes de AWS que quieran compartir experiencias, desarrollos, casos de éxito y anécdotas sobre los servicios en la nube en un entorno social.',
    website: 'https://www.meetup.com/es-ES/madrid-amazon-web-services-meetup/', meetupUrl: 'https://www.meetup.com/es-ES/madrid-amazon-web-services-meetup/',
    eventSources: meetupSources('madrid-amazon-web-services-meetup'), active: true,
    coordinates: { latitude: 40.4168, longitude: -3.7038 },
  },
  {
    id: 'malaga', name: 'AWS User Group Málaga', city: 'Málaga', region: 'Andalucía',
    description: 'Comunidad abierta para profesionales, estudiantes, entusiastas y personas curiosas por el cloud computing. Comparte buenas prácticas, arquitecturas y casos de uso de AWS mediante charlas técnicas, talleres, demostraciones y encuentros sociales para todos los niveles.',
    website: 'https://www.meetup.com/es-ES/aws-user-group-malaga/', meetupUrl: 'https://www.meetup.com/es-ES/aws-user-group-malaga/',
    eventSources: meetupSources('aws-user-group-malaga'), active: true,
    coordinates: { latitude: 36.7213, longitude: -4.4214 },
  },
  {
    id: 'palma', name: 'AWS User Group Palma de Mallorca', city: 'Palma de Mallorca', region: 'Illes Balears',
    description: 'Grupo de usuarios de AWS en Palma abierto tanto a quienes empiezan como a personas expertas. Sus encuentros tratan consejos, nuevas funcionalidades y casos de uso mediante sesiones informativas, demostraciones prácticas y oportunidades de networking.',
    website: 'https://www.meetup.com/es-ES/awsusergrouppalma/', meetupUrl: 'https://www.meetup.com/es-ES/awsusergrouppalma/',
    eventSources: meetupSources('awsusergrouppalma'), active: true,
    coordinates: { latitude: 39.5696, longitude: 2.6502 },
  },
  {
    id: 'sevilla', name: 'AWS User Group Sevilla', city: 'Sevilla', region: 'Andalucía',
    description: 'Grupo oficial de usuarios y usuarias de AWS en Sevilla. Construye una comunidad para aprender, compartir ideas y recursos mediante charlas y talleres cuyo hilo conductor es la nube pública de Amazon, dentro de un entorno seguro, diverso e inclusivo.',
    website: 'https://awsugsevilla.com/', meetupUrl: 'https://www.meetup.com/aws-user-group-sevilla/',
    eventSources: meetupSources('aws-user-group-sevilla'), active: true,
    coordinates: { latitude: 37.3891, longitude: -5.9845 },
  },
  {
    id: 'valencia', name: 'AWS User Group Valencia', city: 'Valencia', region: 'Comunitat Valenciana',
    description: 'Comunidad para personas apasionadas por las nuevas tecnologías y los servicios cloud de AWS. Se reúne para compartir experiencias, desarrollar proyectos, analizar casos de éxito y aprender mediante talleres, charlas, mesas redondas y eventos de networking.',
    website: 'https://www.meetup.com/aws-valencia/', meetupUrl: 'https://www.meetup.com/aws-valencia/',
    eventSources: meetupSources('aws-valencia'), active: true,
    coordinates: { latitude: 39.4699, longitude: -0.3763 },
  },
  {
    id: 'zaragoza', name: 'AWS User Group Zaragoza', city: 'Zaragoza', region: 'Aragón',
    description: 'Comunidad de profesionales, estudiantes y personas curiosas por AWS en Zaragoza. Un espacio para aprender, compartir conocimiento, conectar con otras personas del ecosistema cloud y ampliar el horizonte profesional.',
    website: 'https://www.meetup.com/es-ES/awszgz/', meetupUrl: 'https://www.meetup.com/es-ES/awszgz/',
    eventSources: meetupSources('awszgz'), active: true,
    coordinates: { latitude: 41.6488, longitude: -0.8891 },
  },
];
