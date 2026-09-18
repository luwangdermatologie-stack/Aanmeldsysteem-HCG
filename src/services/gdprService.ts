/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, getDocs, doc, writeBatch, updateDoc, setDoc } from 'firebase/firestore';
import { db, sanitizeForFirestore, handleFirestoreError, OperationType } from '../firebase';
import { Patient, SystemConfig } from '../types';

/**
 * Anonymizes an individual patient's personal identifiers according to GDPR (AVG) guidelines.
 * Retains operational metadata (wait room, appointment time, doctor, status) for clinic analytics.
 */
export function anonymizePatientData(patient: Patient): Partial<Patient> {
  const initial = patient.lastName && patient.lastName !== '-' 
    ? `${patient.lastName.charAt(0).toUpperCase()}***` 
    : '***';

  return {
    firstName: 'Patiënt',
    lastName: initial,
    nationalRegistryNum: '**-**-**',
    birthDate: '',
    idCardNum: '',
    phone: '',
    isAnonymized: true,
    anonymizedAt: new Date().toISOString()
  };
}

/**
 * Executes GDPR retention scan and anonymizes patient records exceeding the retention threshold.
 * @param retentionHours Hours after arrival before patient records are anonymized (default: 24h)
 */
export async function executeGdprAnonymization(
  retentionHours: number = 24
): Promise<{ processed: number; anonymized: number }> {
  try {
    const patientsRef = collection(db, 'patients');
    const snapshot = await getDocs(patientsRef);

    if (snapshot.empty) {
      return { processed: 0, anonymized: 0 };
    }

    const now = Date.now();
    const cutoffMs = now - (retentionHours * 60 * 60 * 1000);
    const batch = writeBatch(db);
    let anonymizedCount = 0;
    let processedCount = 0;

    snapshot.forEach((docSnap) => {
      processedCount++;
      const patient = docSnap.data() as Patient;

      // Skip already anonymized records
      if (patient.isAnonymized) {
        return;
      }

      // Determine arrival timestamp
      let arrivalTimestamp = 0;
      if (patient.arrivalDate && patient.arrivalTime) {
        const parsed = Date.parse(`${patient.arrivalDate}T${patient.arrivalTime}`);
        if (!isNaN(parsed)) {
          arrivalTimestamp = parsed;
        }
      }

      // Fallback: If date parsing failed or arrivalDate is today, check if older than retentionHours
      if (!arrivalTimestamp && patient.arrivalDate) {
        const parsed = Date.parse(patient.arrivalDate);
        if (!isNaN(parsed)) {
          arrivalTimestamp = parsed;
        }
      }

      // If timestamp exceeds the retention period cutoff
      if (arrivalTimestamp && arrivalTimestamp < cutoffMs) {
        const maskedFields = anonymizePatientData(patient);
        batch.update(docSnap.ref, sanitizeForFirestore(maskedFields));
        anonymizedCount++;
      }
    });

    if (anonymizedCount > 0) {
      await batch.commit();

      // Record audit entry in notifications collection
      const notifId = `gdpr-${Date.now()}`;
      const auditEntry = {
        id: notifId,
        timestamp: new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        targetDoctor: 'GDPR / Functionaris Gegevensbescherming',
        message: `🛡️ **GDPR Gegevensretentie Uitgevoerd**: ${anonymizedCount} patiëntendossier(s) zijn succesvol geanonimiseerd conform de bewaartermijn van ${retentionHours} uur.`,
        isRead: false
      };

      await setDoc(doc(db, 'notifications', notifId), sanitizeForFirestore(auditEntry));
    }

    // Update lastGdprRun timestamp in config
    const configDoc = doc(db, 'config', 'system');
    await updateDoc(configDoc, {
      lastGdprRun: new Date().toISOString()
    });

    return { processed: processedCount, anonymized: anonymizedCount };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'patients');
    throw error;
  }
}
