import { Component, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/models/user.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  showPassword = false;
  showConfirmPassword = false;
  Role = Role;
  selectedRole: string = Role.PASSENGER;
  dropdownOpen = false;

  countries = [
    // Afrique du Nord / Maghreb
    { code: '+216', iso: 'tn', name: 'Tunisie' },
    { code: '+213', iso: 'dz', name: 'Algérie' },
    { code: '+212', iso: 'ma', name: 'Maroc' },
    { code: '+212', iso: 'eh', name: 'Sahara Occidental' },
    { code: '+218', iso: 'ly', name: 'Libye' },
    { code: '+222', iso: 'mr', name: 'Mauritanie' },

    // Afrique de l'Ouest
    { code: '+221', iso: 'sn', name: 'Sénégal' },
    { code: '+223', iso: 'ml', name: 'Mali' },
    { code: '+225', iso: 'ci', name: "Côte d'Ivoire" },
    { code: '+226', iso: 'bf', name: 'Burkina Faso' },
    { code: '+227', iso: 'ne', name: 'Niger' },
    { code: '+228', iso: 'tg', name: 'Togo' },
    { code: '+229', iso: 'bj', name: 'Bénin' },
    { code: '+234', iso: 'ng', name: 'Nigéria' },
    { code: '+233', iso: 'gh', name: 'Ghana' },
    { code: '+224', iso: 'gn', name: 'Guinée' },
    { code: '+245', iso: 'gw', name: 'Guinée-Bissau' },
    { code: '+232', iso: 'sl', name: 'Sierra Leone' },
    { code: '+231', iso: 'lr', name: 'Liberia' },

    // Afrique Centrale & Est
    { code: '+237', iso: 'cm', name: 'Cameroun' },
    { code: '+241', iso: 'ga', name: 'Gabon' },
    { code: '+242', iso: 'cg', name: 'Congo' },
    { code: '+243', iso: 'cd', name: 'RDC' },
    { code: '+236', iso: 'cf', name: 'Centrafrique' },
    { code: '+235', iso: 'td', name: 'Tchad' },
    { code: '+240', iso: 'gq', name: 'Guinée Équatoriale' },
    { code: '+239', iso: 'st', name: 'São Tomé' },
    { code: '+244', iso: 'ao', name: 'Angola' },
    { code: '+254', iso: 'ke', name: 'Kenya' },
    { code: '+255', iso: 'tz', name: 'Tanzanie' },
    { code: '+256', iso: 'ug', name: 'Ouganda' },
    { code: '+250', iso: 'rw', name: 'Rwanda' },
    { code: '+257', iso: 'bi', name: 'Burundi' },
    { code: '+251', iso: 'et', name: 'Éthiopie' },
    { code: '+249', iso: 'sd', name: 'Soudan' },
    { code: '+211', iso: 'ss', name: 'Soudan du Sud' },
    { code: '+258', iso: 'mz', name: 'Mozambique' },
    { code: '+265', iso: 'mw', name: 'Malawi' },
    { code: '+260', iso: 'zm', name: 'Zambie' },
    { code: '+263', iso: 'zw', name: 'Zimbabwe' },
    { code: '+267', iso: 'bw', name: 'Botswana' },
    { code: '+266', iso: 'ls', name: 'Lesotho' },
    { code: '+268', iso: 'sz', name: 'Eswatini' },
    { code: '+27', iso: 'za', name: 'Afrique du Sud' },
    { code: '+264', iso: 'na', name: 'Namibie' },
    { code: '+261', iso: 'mg', name: 'Madagascar' },
    { code: '+262', iso: 're', name: 'La Réunion' },
    { code: '+230', iso: 'mu', name: 'Maurice' },
    { code: '+269', iso: 'km', name: 'Comores' },
    { code: '+248', iso: 'sc', name: 'Seychelles' },

    // Europe
    { code: '+33', iso: 'fr', name: 'France' },
    { code: '+32', iso: 'be', name: 'Belgique' },
    { code: '+352', iso: 'lu', name: 'Luxembourg' },
    { code: '+41', iso: 'ch', name: 'Suisse' },
    { code: '+377', iso: 'mc', name: 'Monaco' },
    { code: '+44', iso: 'gb', name: 'Royaume-Uni' },
    { code: '+353', iso: 'ie', name: 'Irlande' },
    { code: '+49', iso: 'de', name: 'Allemagne' },
    { code: '+39', iso: 'it', name: 'Italie' },
    { code: '+34', iso: 'es', name: 'Espagne' },
    { code: '+351', iso: 'pt', name: 'Portugal' },
    { code: '+31', iso: 'nl', name: 'Pays-Bas' },
    { code: '+45', iso: 'dk', name: 'Danemark' },
    { code: '+46', iso: 'se', name: 'Suède' },
    { code: '+47', iso: 'no', name: 'Norvège' },
    { code: '+358', iso: 'fi', name: 'Finlande' },
    { code: '+43', iso: 'at', name: 'Autriche' },
    { code: '+30', iso: 'gr', name: 'Grèce' },
    { code: '+48', iso: 'pl', name: 'Pologne' },
    { code: '+420', iso: 'cz', name: 'Tchéquie' },
    { code: '+421', iso: 'sk', name: 'Slovaquie' },
    { code: '+36', iso: 'hu', name: 'Hongrie' },
    { code: '+40', iso: 'ro', name: 'Roumanie' },
    { code: '+359', iso: 'bg', name: 'Bulgarie' },
    { code: '+386', iso: 'si', name: 'Slovénie' },
    { code: '+385', iso: 'hr', name: 'Croatie' },
    { code: '+381', iso: 'rs', name: 'Serbie' },
    { code: '+382', iso: 'me', name: 'Monténégro' },
    { code: '+387', iso: 'ba', name: 'Bosnie' },
    { code: '+389', iso: 'mk', name: 'Macédoine du Nord' },
    { code: '+372', iso: 'ee', name: 'Estonie' },
    { code: '+371', iso: 'lv', name: 'Lettonie' },
    { code: '+370', iso: 'lt', name: 'Lituanie' },
    { code: '+375', iso: 'by', name: 'Biélorussie' },
    { code: '+380', iso: 'ua', name: 'Ukraine' },
    { code: '+7', iso: 'ru', name: 'Russie' },
    { code: '+90', iso: 'tr', name: 'Turquie' },
    { code: '+374', iso: 'am', name: 'Arménie' },
    { code: '+995', iso: 'ge', name: 'Géorgie' },
    { code: '+994', iso: 'az', name: 'Azerbaïdjan' },

    // Moyen-Orient
    { code: '+966', iso: 'sa', name: 'Arabie Saoudite' },
    { code: '+971', iso: 'ae', name: 'Émirats Arabes Unis' },
    { code: '+974', iso: 'qa', name: 'Qatar' },
    { code: '+965', iso: 'kw', name: 'Koweït' },
    { code: '+973', iso: 'bh', name: 'Bahreïn' },
    { code: '+968', iso: 'om', name: 'Oman' },
    { code: '+962', iso: 'jo', name: 'Jordanie' },
    { code: '+961', iso: 'lb', name: 'Liban' },
    { code: '+963', iso: 'sy', name: 'Syrie' },
    { code: '+964', iso: 'iq', name: 'Irak' },
    { code: '+98', iso: 'ir', name: 'Iran' },
    { code: '+967', iso: 'ye', name: 'Yémen' },

    // Amériques
    { code: '+1', iso: 'us', name: 'USA' },
    { code: '+1', iso: 'ca', name: 'Canada' },
    { code: '+55', iso: 'br', name: 'Brésil' },
    { code: '+54', iso: 'ar', name: 'Argentine' },
    { code: '+52', iso: 'mx', name: 'Mexique' },
    { code: '+56', iso: 'cl', name: 'Chili' },
    { code: '+57', iso: 'co', name: 'Colombie' },
    { code: '+51', iso: 'pe', name: 'Pérou' },
    { code: '+593', iso: 'ec', name: 'Équateur' },
    { code: '+58', iso: 've', name: 'Venezuela' },
    { code: '+591', iso: 'bo', name: 'Bolivie' },
    { code: '+595', iso: 'py', name: 'Paraguay' },
    { code: '+598', iso: 'uy', name: 'Uruguay' },
    { code: '+592', iso: 'gy', name: 'Guyana' },
    { code: '+597', iso: 'sr', name: 'Suriname' },

    // Asie
    { code: '+86', iso: 'cn', name: 'Chine' },
    { code: '+91', iso: 'in', name: 'Inde' },
    { code: '+81', iso: 'jp', name: 'Japon' },
    { code: '+82', iso: 'kr', name: 'Corée du Sud' },
    { code: '+62', iso: 'id', name: 'Indonésie' },
    { code: '+60', iso: 'my', name: 'Malaisie' },
    { code: '+65', iso: 'sg', name: 'Singapour' },
    { code: '+66', iso: 'th', name: 'Thaïlande' },
    { code: '+84', iso: 'vn', name: 'Vietnam' },
    { code: '+63', iso: 'ph', name: 'Philippines' },
    { code: '+92', iso: 'pk', name: 'Pakistan' },
    { code: '+880', iso: 'bd', name: 'Bangladesh' },
    { code: '+95', iso: 'mm', name: 'Myanmar' },
    { code: '+855', iso: 'kh', name: 'Cambodge' },
    { code: '+856', iso: 'la', name: 'Laos' },
    { code: '+94', iso: 'lk', name: 'Sri Lanka' },
    { code: '+977', iso: 'np', name: 'Népal' },
    { code: '+975', iso: 'bt', name: 'Bhoutan' },
    { code: '+960', iso: 'mv', name: 'Maldives' },
    { code: '+93', iso: 'af', name: 'Afghanistan' },
    { code: '+992', iso: 'tj', name: 'Tadjikistan' },
    { code: '+993', iso: 'tm', name: 'Turkménistan' },
    { code: '+996', iso: 'kg', name: 'Kirghizistan' },
    { code: '+998', iso: 'uz', name: 'Ouzbékistan' },
    { code: '+7', iso: 'kz', name: 'Kazakhstan' },
    { code: '+976', iso: 'mn', name: 'Mongolie' },

    // Océanie
    { code: '+61', iso: 'au', name: 'Australie' },
    { code: '+64', iso: 'nz', name: 'Nouvelle-Zélande' },
    { code: '+679', iso: 'fj', name: 'Fidji' },
    { code: '+675', iso: 'pg', name: 'Papouasie' },
    { code: '+678', iso: 'vu', name: 'Vanuatu' },
    { code: '+685', iso: 'ws', name: 'Samoa' },
    { code: '+682', iso: 'ck', name: 'Îles Cook' },
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toast: ToastService,
  ) {
    this.registerForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      countryCode: ['+216', Validators.required],
      role: [Role.PASSENGER, Validators.required],
    });

    this.registerForm.get('role')?.valueChanges.subscribe((role: string) => {
      this.selectedRole = role;
      this.updateValidatorsForRole(role);
    });
  }

  setRole(role: string): void {
    this.registerForm.get('role')?.setValue(role);
  }

  updateValidatorsForRole(role: string): void {
    const driverFields = ['licenseNumber', 'vehicleModel', 'plateNumber'];
    const organizerFields = ['organizationName', 'registrationNumber', 'certificateNumber'];

    [...driverFields, ...organizerFields].forEach((field) => {
      const ctrl = this.registerForm.get(field);
      ctrl?.clearValidators();
      ctrl?.updateValueAndValidity();
    });

    if (role === Role.DRIVER) {
      driverFields.forEach((field) => {
        this.registerForm.get(field)?.setValidators(Validators.required);
        this.registerForm.get(field)?.updateValueAndValidity();
      });
    } else if (role === Role.ORGANIZER) {
      organizerFields.forEach((field) => {
        this.registerForm.get(field)?.setValidators(Validators.required);
        this.registerForm.get(field)?.updateValueAndValidity();
      });
    }
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  selectCountry(country: any): void {
    this.registerForm.get('countryCode')?.setValue(country.code);
    this.dropdownOpen = false;
  }

  getSelectedCountry(): any {
    const code = this.registerForm.get('countryCode')?.value;
    return this.countries.find((c) => c.code === code) || this.countries[0];
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.country-dropdown')) {
      this.dropdownOpen = false;
    }
  }

  onSubmit(): void {
    if (this.registerForm.value.password !== this.registerForm.value.confirmPassword) {
      this.toast.error('Les mots de passe ne correspondent pas.');
      return;
    }

    if (this.registerForm.invalid) {
      this.toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    this.loading = true;
    const formValue = this.registerForm.value;

    // ✅ FIXED: Build payload with only backend-expected fields
    const payload = {
      name: formValue.fullName,
      email: formValue.email,
      password: formValue.password,
      phoneNumber: `${formValue.countryCode}${formValue.phoneNumber}`,
      role: formValue.role,
    };

    // ✅ FIXED: Send payload instead of raw form value
    this.authService.register(payload).subscribe({
      next: () => {
        this.toast.success('Compte créé avec succès !');
        setTimeout(() => this.router.navigate(['/auth/login']), 1500);
      },
      error: (err) => {
        this.toast.error(err.error?.message || "Erreur lors de l'inscription");
        this.loading = false;
      },
    });
  }
}
