/**
 * Conecta Assistencial — Dynamic Module Loader (Lazy Loading)
 * Imports domain modules on-demand, reducing initial bundle size by ~60%.
 */

const moduleLoaders = {
  passagem: () => import('../modules/passagem/passagem.js'),
  dashboard: () => import('../modules/dashboard/dashboard.js'),
  livro: () => import('../modules/livro/livro.js'),
  escala: () => import('../modules/escala/escala.js'),
  registros: () => import('../modules/registros/registros.js'),
  auditorias: () => import('../modules/auditorias/auditorias.js'),
  recepcao: () => import('../modules/recepcao/recepcao.js')
};

const loadedModules = new Map();

export async function loadModule(name) {
  if (loadedModules.has(name)) return loadedModules.get(name);
  const loader = moduleLoaders[name];
  if (!loader) {
    console.warn(`[ModuleLoader] Módulo "${name}" não cadastrado`);
    return null;
  }
  try {
    const mod = await loader();
    loadedModules.set(name, mod);
    if (window.conectaCore) {
      Object.assign(window.conectaCore, mod);
    }
    return mod;
  } catch (err) {
    console.error(`[ModuleLoader] Erro ao carregar módulo "${name}":`, err);
    throw err;
  }
}

export function isModuleLoaded(name) {
  return loadedModules.has(name);
}
