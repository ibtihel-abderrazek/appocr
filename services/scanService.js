// services/scanService.js
class ScanService {
    constructor() {
        this.scannersCache = null;
        this.lastFetch = null;
        this.cacheTimeout = 30000; // 30 secondes
    }

    /**
     * Récupère la liste des scanners connectés
     */
    async getConnectedScanners(forceRefresh = false) {
        try {
            // Vérifier le cache
            if (!forceRefresh && this.scannersCache && this.lastFetch && 
                (Date.now() - this.lastFetch < this.cacheTimeout)) {
                return this.scannersCache;
            }

            console.log('Récupération des scanners depuis le serveur...');
            
            const response = await fetch('/scanners', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Mise à jour du cache
                this.scannersCache = data;
                this.lastFetch = Date.now();
                
                console.log(`${data.scanners.length} scanners trouvés`);
                return data;
            } else {
                throw new Error(data.error || 'Erreur lors de la récupération des scanners');
            }

        } catch (error) {
            console.error('Erreur ScannerService:', error);
            
            // Retourner des scanners par défaut en cas d'erreur
            const fallbackData = {
                success: false,
                scanners: [
                    {
                        id: 'TWAIN2 FreeImage Software Scanner',
                        name: 'TWAIN2 FreeImage Software Scanner',
                        driver: 'TWAIN',
                        displayName: 'TWAIN2 FreeImage Software Scanner (TWAIN)'
                    }
                ],
                count: 1,
                error: error.message,
                isFallback: true
            };
            
            return fallbackData;
        }
    }

    /**
     * Teste un scanner spécifique
     */
    async testScanner(scannerName) {
        try {
            const response = await fetch(`scanners/test/${encodeURIComponent(scannerName)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Erreur test scanner:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Force la mise à jour des scanners
     */
    async refreshScanners() {
        this.scannersCache = null;
        this.lastFetch = null;
        return await this.getConnectedScanners(true);
    }

    /**
     * Crée les options HTML pour un select
     */
    createScannerOptions(scanners, selectedValue = null) {
        if (!scanners || scanners.length === 0) {
            return '<option value="">Aucun scanner détecté</option>';
        }

        return scanners.map(scanner => {
            const isSelected = selectedValue && 
                (selectedValue === scanner.id || selectedValue === scanner.name) ? 'selected' : '';
            
            return `<option value="${scanner.id}" ${isSelected} data-driver="${scanner.driver}">
                ${scanner.displayName}
            </option>`;
        }).join('');
    }

    /**
     * Met à jour un select avec la liste des scanners
     */
    async populateScannerSelect(selectElement, selectedValue = null, showRefreshButton = true) {
        try {
            // Afficher un indicateur de chargement
            selectElement.innerHTML = '<option value="">Chargement...</option>';
            selectElement.disabled = true;

            const data = await this.getConnectedScanners();
            
            // Ajouter une option par défaut
            let optionsHtml = '<option value="">Sélectionnez un scanner</option>';
            
            if (data.scanners && data.scanners.length > 0) {
                optionsHtml += this.createScannerOptions(data.scanners, selectedValue);
            } else {
                optionsHtml += '<option value="">Aucun scanner trouvé</option>';
            }

            selectElement.innerHTML = optionsHtml;
            selectElement.disabled = false;

            // Ajouter un bouton de rafraîchissement si demandé
            if (showRefreshButton && !selectElement.nextElementSibling?.classList.contains('refresh-scanners-btn')) {
                const refreshBtn = document.createElement('button');
                refreshBtn.type = 'button';
                refreshBtn.className = 'btn-refresh refresh-scanners-btn';
                refreshBtn.innerHTML = '🔄';
                refreshBtn.title = 'Actualiser la liste des scanners';
                refreshBtn.style.marginLeft = '5px';
                
                refreshBtn.addEventListener('click', async () => {
                    refreshBtn.disabled = true;
                    refreshBtn.innerHTML = '⏳';
                    
                    try {
                        await this.refreshScanners();
                        await this.populateScannerSelect(selectElement, selectElement.value, false);
                        Utils.showNotification('Liste des scanners mise à jour', 'success');
                    } catch (error) {
                        Utils.showNotification('Erreur lors de la mise à jour: ' + error.message, 'error');
                    } finally {
                        refreshBtn.disabled = false;
                        refreshBtn.innerHTML = '🔄';
                    }
                });

                selectElement.parentNode.insertBefore(refreshBtn, selectElement.nextSibling);
            }

            // Afficher un message si c'est un fallback
            if (data.isFallback) {
                Utils.showNotification('Impossible de détecter les scanners. Utilisation de la configuration par défaut.', 'warning');
            }

        } catch (error) {
            console.error('Erreur populate scanner select:', error);
            selectElement.innerHTML = '<option value="">Erreur de chargement</option>';
            selectElement.disabled = false;
        }
    }

    /**
     * Valide qu'un scanner est disponible
     */
    async validateScanner(scannerName) {
        if (!scannerName) return false;

        try {
            const data = await this.getConnectedScanners();
            return data.scanners.some(scanner => 
                scanner.id === scannerName || scanner.name === scannerName
            );
        } catch (error) {
            console.error('Erreur validation scanner:', error);
            return false;
        }
    }
}

// Export global si côté navigateur
if (typeof window !== 'undefined') {
    window.ScanService = ScanService;
}

// Export si côté Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScanService;
}
