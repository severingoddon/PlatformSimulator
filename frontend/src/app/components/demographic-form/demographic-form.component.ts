import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserSessionService } from '../../services/user-session.service';
import { sha256 } from '../../utils/hash.util';

@Component({
  selector: 'app-demographic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './demographic-form.component.html',
  styleUrl: './demographic-form.component.scss',
})
export class DemographicFormComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private session = inject(UserSessionService);

  religionOptions = [
    'Christentum (Katholisch)',
    'Christentum (Reformiert)',
    'Christentum (Andere)',
    'Islam',
    'Judentum',
    'Hinduismus',
    'Buddhismus',
    'Andere',
    'Keine / Konfessionslos',
  ];

  bildungOptions = [
    'Keine formale Ausbildung',
    'Obligatorische Schule (Sekundarstufe I)',
    'Berufslehre / EFZ',
    'Berufsmaturität',
    'Gymnasiale Maturität',
    'Höhere Fachschule (HF)',
    'Fachhochschule (FH) – Bachelor/Master',
    'Universität / ETH – Bachelor/Master/Doktorat',
  ];

  form: FormGroup = this.fb.group({
    alter: [null, [Validators.required, Validators.min(13), Validators.max(120)]],
    religionsangehoerigkeit: ['', Validators.required],
    bildungsabschluss: ['', Validators.required],
    herkunft: ['', Validators.required],
    politischeEinstellung: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
    email: ['', [Validators.required, Validators.email]],
  });

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.value;
    const emailHash = await sha256(values.email);

    this.session.setDemographics({
      alter: values.alter,
      religionsangehoerigkeit: values.religionsangehoerigkeit,
      bildungsabschluss: values.bildungsabschluss,
      herkunft: values.herkunft,
      politischeEinstellung: values.politischeEinstellung,
      userEmailHash: emailHash,
    });

    this.router.navigate(['/feed']);
  }
}
