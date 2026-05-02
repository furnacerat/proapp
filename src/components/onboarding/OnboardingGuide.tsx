import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardList, FileText, Hammer, PackageCheck, Settings, Sparkles, UserPlus, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { starterAssemblies, starterLaborRates, starterMaterials, starterTemplates } from '../../data/starterKit';

function hasName(items: { name: string }[], name: string) {
  return items.some(item => item.name.trim().toLowerCase() === name.trim().toLowerCase());
}

export function OnboardingGuide() {
  const {
    customers,
    jobs,
    estimates,
    laborRates,
    materials,
    assemblies,
    templates,
    workers,
    branding,
    addLaborRate,
    addMaterial,
    addAssembly,
    addTemplate,
  } = useApp();
  const { showToast } = useToast();

  const starterRatesInstalled = starterLaborRates.every(rate => hasName(laborRates, rate.name));
  const starterMaterialsInstalled = starterMaterials.every(material => hasName(materials, material.name));
  const starterAssembliesInstalled = starterAssemblies.every(assembly => hasName(assemblies, assembly.name));
  const starterTemplatesInstalled = starterTemplates.every(template => hasName(templates, template.name));
  const starterKitInstalled = starterRatesInstalled && starterMaterialsInstalled && starterAssembliesInstalled && starterTemplatesInstalled;

  const setupItems = [
    {
      label: 'Company details',
      detail: 'Brand name, proposal terms, tax rate, and email settings.',
      complete: Boolean(branding.brandName && branding.paymentTerms),
      to: '/settings',
      icon: Settings,
    },
    {
      label: 'Starter estimating kit',
      detail: 'Useful rates, price book items, assemblies, and templates.',
      complete: starterKitInstalled,
      action: 'install-kit',
      icon: PackageCheck,
    },
    {
      label: 'First customer',
      detail: 'Add a real customer when there is one to track.',
      complete: customers.length > 0,
      to: '/customers',
      icon: Users,
    },
    {
      label: 'First estimate',
      detail: 'Use a starter template or build manually.',
      complete: estimates.length > 0,
      to: '/estimates/new',
      icon: FileText,
    },
    {
      label: 'First job',
      detail: 'Create or convert a real approved estimate.',
      complete: jobs.length > 0,
      to: '/jobs',
      icon: Hammer,
    },
    {
      label: 'Crew roster',
      detail: 'Add workers or subcontractors only when you need them.',
      complete: workers.length > 0,
      to: '/workers',
      icon: UserPlus,
    },
  ];

  const completed = setupItems.filter(item => item.complete).length;
  const progress = Math.round((completed / setupItems.length) * 100);

  const installStarterKit = () => {
    let added = 0;

    starterLaborRates.forEach(rate => {
      if (!hasName(laborRates, rate.name)) {
        addLaborRate(rate);
        added += 1;
      }
    });

    starterMaterials.forEach(material => {
      if (!hasName(materials, material.name)) {
        addMaterial(material);
        added += 1;
      }
    });

    starterAssemblies.forEach(assembly => {
      if (!hasName(assemblies, assembly.name)) {
        addAssembly(assembly);
        added += 1;
      }
    });

    starterTemplates.forEach(template => {
      if (!hasName(templates, template.name)) {
        addTemplate(template);
        added += 1;
      }
    });

    showToast(added ? `Starter kit installed: ${added} reusable items added.` : 'Starter kit is already installed.', added ? 'success' : 'info');
  };

  if (progress === 100 && jobs.length > 0) return null;

  return (
    <section className="onboarding-guide">
      <div className="onboarding-guide-main">
        <div className="onboarding-guide-copy">
          <span className="onboarding-eyebrow"><Sparkles size={15} /> Guided setup</span>
          <h2>Make this workspace useful before adding job data</h2>
          <p>Start with reusable setup items. No fake customers, jobs, invoices, or history are created.</p>
        </div>
        <div className="onboarding-progress" aria-label={`Setup ${progress}% complete`}>
          <strong>{progress}%</strong>
          <span>setup</span>
        </div>
      </div>

      <div className="onboarding-steps">
        {setupItems.map(item => {
          const Icon = item.icon;
          const content = (
            <>
              <div className={`onboarding-step-icon ${item.complete ? 'complete' : ''}`}>
                {item.complete ? <CheckCircle2 size={18} /> : <Icon size={18} />}
              </div>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            </>
          );

          if (item.action === 'install-kit') {
            return (
              <button key={item.label} className={`onboarding-step ${item.complete ? 'complete' : ''}`} onClick={installStarterKit}>
                {content}
              </button>
            );
          }

          return (
            <Link key={item.label} to={item.to || '/'} className={`onboarding-step ${item.complete ? 'complete' : ''}`}>
              {content}
            </Link>
          );
        })}
      </div>

      <div className="onboarding-footer">
        <div>
          <ClipboardList size={17} />
          <span>Best first move: install the starter kit, then edit rates and templates to match your business.</span>
        </div>
        <button className="btn btn-primary" onClick={installStarterKit} disabled={starterKitInstalled}>
          <PackageCheck size={18} />
          {starterKitInstalled ? 'Starter Kit Installed' : 'Install Starter Kit'}
        </button>
      </div>
    </section>
  );
}
