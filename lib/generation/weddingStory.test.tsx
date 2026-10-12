import { expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeddingStory } from '@/components/layouts/WeddingStory';
import { Content } from '@/lib/schema/content';
import { Theme } from '@/lib/schema/theme';
import { validateTheme } from '@/lib/theme/validate';
import { composeSeries } from './series';
import { fixtureSeries } from './fixture';
import { directAsset, unusedAsset } from '@/lib/assets/crop';
const content=Content.parse({slug:'story-test',locale:'ru',eventType:'wedding',hosts:[{name:'Хумоюн'},{name:'Асаль'}],date:{start:'2027-02-28T18:23:00+05:00'},venue:{name:'Hilton',address:'Мустакиллик'}});
const theme=Theme.parse({...composeSeries(fixtureSeries,'ru',[]).themes[0],artwork:'none',foil:{enabled:false,color:'#D9B967'},ornament:{pack:'none',density:'light',placement:[],color:'accent'},layout:{...fixtureSeries.variants[0].layout,composition:'keepsake'}});
test('the calendar remains available without RSVP or a greeting, and absent sections stay absent',()=>{
 const markup=renderToStaticMarkup(<WeddingStory content={content} theme={theme} photos={[]} initialNow={0} embedded />);
 expect(markup).toContain('id="story-date"');expect(markup).toMatch(/date[Tt]ime="2027-02-28"/);expect(markup).toContain('data-selected="true"');
 expect(markup).not.toContain('id="rsvp"');expect(markup).not.toContain('id="timeline"');expect(markup).not.toContain('id="greeting"');expect(markup.match(/<h1 /g)).toHaveLength(1);
});
test('an enabled usable photo appears exactly once in the prologue with its protected crop and eager loading',()=>{
 const asset={...unusedAsset('personal-photo',{width:1024,height:768}),role:'portrait' as const,placement:{section:'greeting' as const,index:0}};
 const photo=directAsset(asset,'/photo.webp',{width:1024,height:768},'none')!;
 const markup=renderToStaticMarkup(<WeddingStory content={{...content,greeting:'Рады вам'}} theme={{...theme,photos:[{id:asset.id,section:'greeting',index:0,position:'before'}]}} photos={[photo]} initialNow={0} embedded />);
 expect(markup.match(/data-photo-id="personal-photo"/g)).toHaveLength(1);expect(markup).toContain('data-crop="whole"');expect(markup).toContain('loading="eager"');expect(markup).toContain('60vw');expect(markup).not.toContain('data-photo-section="hero"');
});
test('native wedding stories reject incompatible art or a section order the renderer cannot honour',()=>{
 expect(validateTheme(theme,{locale:'ru'}).ok).toBe(true);
 expect(validateTheme({...theme,ornament:{...theme.ornament,pack:'art-deco'}},{locale:'ru'}).ok).toBe(false);
 expect(validateTheme({...theme,layout:{...theme.layout,sectionOrder:['hero','venue','greeting','footer']}},{locale:'ru'}).ok).toBe(false);
});
